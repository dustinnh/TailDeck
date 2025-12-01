import 'server-only';

import { logger } from '@/lib/logger';

import type { FlowLogProvider } from './provider';
import { LokiProvider } from './providers/loki';
import { NoopProvider } from './providers/noop';

/**
 * Flow Log Client Factory
 *
 * Creates the appropriate flow log provider based on environment configuration.
 * Follows singleton pattern similar to HeadscaleClient.
 */

let providerInstance: FlowLogProvider | null = null;

/**
 * Get the configured flow log provider
 */
export function getFlowLogProvider(): FlowLogProvider {
  if (providerInstance) {
    return providerInstance;
  }

  const lokiUrl = process.env.LOKI_URL;

  if (!lokiUrl) {
    logger.info('Flow logging disabled: LOKI_URL not configured');
    providerInstance = new NoopProvider();
    return providerInstance;
  }

  providerInstance = new LokiProvider({
    url: lokiUrl,
    tenantId: process.env.LOKI_TENANT_ID,
    username: process.env.LOKI_USERNAME,
    password: process.env.LOKI_PASSWORD,
    timeout: parseInt(process.env.LOKI_TIMEOUT ?? '30000', 10),
  });

  logger.info({ provider: 'loki', url: lokiUrl }, 'Flow log provider initialized');
  return providerInstance;
}

/**
 * Check if flow logging is enabled
 */
export function isFlowLoggingEnabled(): boolean {
  return !!process.env.LOKI_URL;
}

// Re-export error class
export { LokiClientError } from './providers/loki';
