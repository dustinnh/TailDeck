/**
 * Diagnostics Service
 *
 * SERVER-ONLY: This file must NEVER be imported by client components.
 * Provides comprehensive health diagnostics for the setup wizard.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale/client';

// ============================================
// Types
// ============================================

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface SecurityWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  remediation?: string;
  canDismiss: boolean;
}

export interface SystemDiagnostics {
  overall: ServiceStatus;
  timestamp: string;
  services: {
    database: ServiceHealth;
    headscale: ServiceHealth;
    oidc: ServiceHealth;
  };
  counts: {
    nodes: number;
    users: number;
    routes: number;
  };
  securityWarnings: SecurityWarning[];
  environment: {
    nodeEnv: string;
    authUrl: string;
    headscaleUrl: string;
    magicDnsEnabled: boolean;
    magicDnsDomain?: string;
  };
}

// ============================================
// Health Check Functions
// ============================================

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;

    return {
      name: 'Database',
      status: 'healthy',
      message: 'PostgreSQL is connected',
      latencyMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error }, 'Database health check failed');

    return {
      name: 'Database',
      status: 'unhealthy',
      message: `Database connection failed: ${message}`,
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Check Headscale health
 */
async function checkHeadscaleHealth(): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    const client = getHeadscaleClient();
    const nodes = await client.listNodes();
    const latencyMs = Date.now() - start;

    return {
      name: 'Headscale',
      status: 'healthy',
      message: `Headscale is connected (${nodes.nodes?.length ?? 0} nodes)`,
      latencyMs,
      details: {
        nodeCount: nodes.nodes?.length ?? 0,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - start;

    if (error instanceof HeadscaleClientError) {
      if (error.code === 'CONNECTION_ERROR') {
        return {
          name: 'Headscale',
          status: 'unhealthy',
          message: 'Cannot connect to Headscale API',
          latencyMs,
        };
      }

      if (error.statusCode === 401 || error.statusCode === 403) {
        return {
          name: 'Headscale',
          status: 'unhealthy',
          message: 'Headscale API key is invalid or expired',
          latencyMs,
        };
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error }, 'Headscale health check failed');

    return {
      name: 'Headscale',
      status: 'unhealthy',
      message: `Headscale error: ${message}`,
      latencyMs,
    };
  }
}

/**
 * Check OIDC provider health
 */
async function checkOIDCHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  const issuer = process.env.AUTH_AUTHENTIK_ISSUER;

  if (!issuer) {
    return {
      name: 'OIDC Provider',
      status: 'unhealthy',
      message: 'AUTH_AUTHENTIK_ISSUER is not configured',
    };
  }

  try {
    // Check the well-known endpoint
    const wellKnownUrl = issuer.endsWith('/')
      ? `${issuer}.well-known/openid-configuration`
      : `${issuer}/.well-known/openid-configuration`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(wellKnownUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      return {
        name: 'OIDC Provider',
        status: 'healthy',
        message: 'Authentik OIDC is configured',
        latencyMs,
      };
    }

    return {
      name: 'OIDC Provider',
      status: 'degraded',
      message: `OIDC well-known endpoint returned ${response.status}`,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        name: 'OIDC Provider',
        status: 'degraded',
        message: 'OIDC provider is slow to respond',
        latencyMs,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    // Connection refused is expected if Authentik isn't running
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return {
        name: 'OIDC Provider',
        status: 'unhealthy',
        message: 'Cannot connect to Authentik - is it running?',
        latencyMs,
      };
    }

    return {
      name: 'OIDC Provider',
      status: 'unhealthy',
      message: `OIDC check failed: ${message}`,
      latencyMs,
    };
  }
}

/**
 * Get entity counts from Headscale
 */
async function getCounts(): Promise<{ nodes: number; users: number; routes: number }> {
  try {
    const client = getHeadscaleClient();
    const [nodesResponse, usersResponse, routesResponse] = await Promise.all([
      client.listNodes().catch(() => ({ nodes: [] })),
      client.listUsers().catch(() => ({ users: [] })),
      client.listRoutes().catch(() => ({ routes: [] })),
    ]);

    return {
      nodes: nodesResponse.nodes?.length ?? 0,
      users: usersResponse.users?.length ?? 0,
      routes: routesResponse.routes?.length ?? 0,
    };
  } catch {
    return { nodes: 0, users: 0, routes: 0 };
  }
}

/**
 * Check for security warnings
 */
function getSecurityWarnings(): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];
  const authUrl = process.env.AUTH_URL || '';
  const authSecret = process.env.AUTH_SECRET || '';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  // Check HTTPS
  if (authUrl.startsWith('http://') && isProduction) {
    warnings.push({
      id: 'http-warning',
      severity: 'critical',
      title: 'Using HTTP in Production',
      description:
        'AUTH_URL is using HTTP instead of HTTPS. This exposes authentication tokens to interception.',
      remediation: 'Configure TLS/HTTPS for your deployment and update AUTH_URL to use https://.',
      canDismiss: false,
    });
  } else if (authUrl.startsWith('http://') && !isProduction) {
    warnings.push({
      id: 'http-dev-warning',
      severity: 'info',
      title: 'Using HTTP (Development)',
      description:
        'AUTH_URL is using HTTP. This is acceptable for development but must be changed for production.',
      canDismiss: true,
    });
  }

  // Check AUTH_SECRET length
  if (authSecret.length < 32) {
    warnings.push({
      id: 'weak-auth-secret',
      severity: 'critical',
      title: 'Weak AUTH_SECRET',
      description: `AUTH_SECRET is only ${authSecret.length} characters. It should be at least 32 characters.`,
      remediation: 'Generate a new secret with: openssl rand -base64 32',
      canDismiss: false,
    });
  }

  // Check for default/weak secrets
  const weakSecrets = ['change-me', 'secret', 'password', 'taildeck'];
  if (weakSecrets.some((weak) => authSecret.toLowerCase().includes(weak))) {
    warnings.push({
      id: 'default-secret',
      severity: 'critical',
      title: 'Default/Weak Secret Detected',
      description: 'AUTH_SECRET appears to contain a default or weak value.',
      remediation: 'Generate a new secret with: openssl rand -base64 32',
      canDismiss: false,
    });
  }

  // Check Authentik client secret
  const authentikSecret = process.env.AUTH_AUTHENTIK_SECRET || '';
  if (!authentikSecret || authentikSecret === 'your-authentik-client-secret') {
    warnings.push({
      id: 'missing-oidc-secret',
      severity: 'critical',
      title: 'OIDC Client Secret Not Configured',
      description:
        'AUTH_AUTHENTIK_SECRET is not properly configured. Authentication will not work.',
      remediation:
        'Configure the OAuth2 provider in Authentik and update AUTH_AUTHENTIK_SECRET in .env.local.',
      canDismiss: false,
    });
  }

  // Check Headscale API key
  const headscaleKey = process.env.HEADSCALE_API_KEY || '';
  if (!headscaleKey || headscaleKey === 'your-headscale-api-key') {
    warnings.push({
      id: 'missing-headscale-key',
      severity: 'critical',
      title: 'Headscale API Key Not Configured',
      description:
        'HEADSCALE_API_KEY is not properly configured. Headscale management will not work.',
      remediation: 'Generate an API key with: docker exec headscale headscale apikeys create',
      canDismiss: false,
    });
  }

  return warnings;
}

/**
 * Get environment information
 */
function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    authUrl: process.env.AUTH_URL || 'http://localhost:3000',
    headscaleUrl: process.env.HEADSCALE_URL || 'http://localhost:8080',
    magicDnsEnabled: true, // TODO: Get from Headscale config
    magicDnsDomain: 'taildeck.local', // TODO: Get from Headscale config
  };
}

/**
 * Determine overall system status
 */
function determineOverallStatus(services: ServiceHealth[]): ServiceStatus {
  if (services.some((s) => s.status === 'unhealthy')) {
    return 'unhealthy';
  }
  if (services.some((s) => s.status === 'degraded')) {
    return 'degraded';
  }
  if (services.some((s) => s.status === 'unknown')) {
    return 'degraded';
  }
  return 'healthy';
}

// ============================================
// Main Export
// ============================================

/**
 * Run full system diagnostics
 */
export async function runDiagnostics(): Promise<SystemDiagnostics> {
  logger.info('Running system diagnostics');

  // Run health checks in parallel
  const [database, headscale, oidc, counts] = await Promise.all([
    checkDatabaseHealth(),
    checkHeadscaleHealth(),
    checkOIDCHealth(),
    getCounts(),
  ]);

  const services = { database, headscale, oidc };
  const overall = determineOverallStatus([database, headscale, oidc]);
  const securityWarnings = getSecurityWarnings();
  const environment = getEnvironmentInfo();

  const diagnostics: SystemDiagnostics = {
    overall,
    timestamp: new Date().toISOString(),
    services,
    counts,
    securityWarnings,
    environment,
  };

  logger.info({ overall, warnings: securityWarnings.length }, 'Diagnostics complete');

  return diagnostics;
}

/**
 * Check a specific service
 */
export async function checkService(
  service: 'database' | 'headscale' | 'oidc'
): Promise<ServiceHealth> {
  switch (service) {
    case 'database':
      return checkDatabaseHealth();
    case 'headscale':
      return checkHeadscaleHealth();
    case 'oidc':
      return checkOIDCHealth();
    default:
      return {
        name: service,
        status: 'unknown',
        message: 'Unknown service',
      };
  }
}
