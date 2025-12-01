/**
 * Flow Logs Health API Route
 *
 * Returns the health status of the flow log backend.
 * Used by the Health page to show flow log integration status.
 *
 * Security:
 * - Requires authentication via Auth.js session
 * - Requires AUDITOR role or higher
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getFlowLogProvider, isFlowLoggingEnabled, LokiClientError } from '@/server/flowlogs';
import { withMinimumRole } from '@/server/middleware/require-role';

/**
 * GET /api/flowlogs/health
 *
 * Returns the health status of the configured flow log backend.
 * Requires AUDITOR role or higher.
 */
export const GET = withMinimumRole('AUDITOR', async (_req, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/flowlogs/health',
  });

  // Check if flow logging is enabled
  const enabled = isFlowLoggingEnabled();
  if (!enabled) {
    return NextResponse.json(
      {
        enabled: false,
        healthy: false,
        provider: 'none',
        message: 'Flow logging not configured',
      },
      {
        headers: { 'X-Request-ID': requestId },
      }
    );
  }

  try {
    childLogger.info(
      {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
      },
      'Authenticated request to check flow log health'
    );

    const provider = getFlowLogProvider();
    const healthy = await provider.healthCheck();

    childLogger.debug({ provider: provider.name, healthy }, 'Flow log health check completed');

    return NextResponse.json(
      {
        enabled: true,
        healthy,
        provider: provider.name,
        message: healthy ? 'Flow log backend is healthy' : 'Flow log backend is unhealthy',
      },
      {
        headers: { 'X-Request-ID': requestId },
      }
    );
  } catch (error) {
    if (error instanceof LokiClientError) {
      childLogger.error(
        { statusCode: error.statusCode, code: error.code },
        `Flow log health check error: ${error.message}`
      );

      return NextResponse.json(
        {
          enabled: true,
          healthy: false,
          provider: 'loki',
          message: error.message,
          error: {
            code: error.code,
            statusCode: error.statusCode,
          },
        },
        {
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    childLogger.error({ error }, 'Unexpected error during health check');

    return NextResponse.json(
      {
        enabled: true,
        healthy: false,
        provider: 'unknown',
        message: 'Unexpected error during health check',
      },
      {
        headers: { 'X-Request-ID': requestId },
      }
    );
  }
});
