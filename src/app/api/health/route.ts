/**
 * Health Check Endpoint
 *
 * Used by Docker health checks and load balancers to verify the app is running.
 * Returns 200 OK with service status information.
 */

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: 'ok' | 'error';
    headscale?: 'ok' | 'error' | 'unconfigured';
  };
}

export async function GET() {
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    checks: {
      database: 'ok',
    },
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    status.checks.database = 'ok';
  } catch {
    status.checks.database = 'error';
    status.status = 'unhealthy';
  }

  // Check Headscale connectivity (if configured)
  const headscaleUrl = process.env.HEADSCALE_URL;
  const headscaleApiKey = process.env.HEADSCALE_API_KEY;

  if (headscaleUrl && headscaleApiKey) {
    try {
      const response = await fetch(`${headscaleUrl}/api/v1/node`, {
        headers: {
          Authorization: `Bearer ${headscaleApiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      status.checks.headscale = response.ok ? 'ok' : 'error';
      if (!response.ok && status.status === 'healthy') {
        status.status = 'degraded';
      }
    } catch {
      status.checks.headscale = 'error';
      if (status.status === 'healthy') {
        status.status = 'degraded';
      }
    }
  } else {
    status.checks.headscale = 'unconfigured';
  }

  const httpStatus = status.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(status, { status: httpStatus });
}
