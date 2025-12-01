/**
 * Flow Logs API Route
 *
 * Proxies authenticated requests to query flow logs from the configured backend (Loki).
 * This route follows the BFF (Backend-for-Frontend) pattern where
 * the browser never directly contacts Loki.
 *
 * Security:
 * - Requires authentication via Auth.js session
 * - Requires AUDITOR role or higher
 * - Validates all requests with Zod schemas
 * - Logs all access for audit purposes
 * - Never exposes Loki credentials to the client
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import {
  getFlowLogProvider,
  isFlowLoggingEnabled,
  LokiClientError,
  flowQueryRequestSchema,
} from '@/server/flowlogs';
import { withMinimumRole } from '@/server/middleware/require-role';

/**
 * GET /api/flowlogs
 *
 * Query flow logs with optional filters.
 * Requires AUDITOR role or higher.
 *
 * Query Parameters:
 * - query: LogQL query string (required)
 * - start: Start time (ISO 8601 or Unix timestamp)
 * - end: End time (ISO 8601 or Unix timestamp)
 * - limit: Max records to return (default: 100, max: 5000)
 * - direction: 'forward' or 'backward' (default: 'backward')
 */
export const GET = withMinimumRole('AUDITOR', async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/flowlogs',
  });

  // Check if flow logging is enabled
  if (!isFlowLoggingEnabled()) {
    childLogger.info('Flow logging not enabled');
    return NextResponse.json(
      {
        error: 'Flow logging not configured',
        message: 'LOKI_URL environment variable is not set',
      },
      {
        status: 503,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }

  try {
    // Parse query parameters
    const { searchParams } = new URL(req.url);

    const rawParams = {
      query: searchParams.get('query'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      limit: searchParams.get('limit'),
      direction: searchParams.get('direction'),
    };

    // Validate request parameters
    const validated = flowQueryRequestSchema.safeParse(rawParams);
    if (!validated.success) {
      childLogger.warn({ errors: validated.error.flatten() }, 'Invalid flow log query parameters');
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validated.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    const params = validated.data;

    // Parse time range
    const now = new Date();
    const timeRange = {
      start: params.start ? new Date(params.start) : new Date(now.getTime() - 60 * 60 * 1000), // Default: last hour
      end: params.end ? new Date(params.end) : now,
    };

    // Log the authenticated request for audit
    childLogger.info(
      {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        query: params.query,
        timeRange: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
        },
        limit: params.limit,
      },
      'Authenticated request to query flow logs'
    );

    // Query the flow log provider
    const provider = getFlowLogProvider();
    const response = await provider.query({
      query: params.query,
      timeRange,
      limit: params.limit,
      direction: params.direction,
    });

    childLogger.debug(
      {
        recordCount: response.records.length,
        hasMore: response.hasMore,
        executionTimeMs: response.stats?.executionTimeMs,
      },
      'Successfully queried flow logs'
    );

    return NextResponse.json(response, {
      headers: {
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    return handleFlowLogError(error, childLogger, requestId);
  }
});

/**
 * Helper to handle flow log API errors consistently
 */
function handleFlowLogError(error: unknown, childLogger: typeof logger, requestId: string) {
  if (error instanceof LokiClientError) {
    childLogger.error(
      { statusCode: error.statusCode, code: error.code },
      `Flow log API error: ${error.message}`
    );

    if (error.statusCode === 504 || error.code === 'TIMEOUT') {
      return NextResponse.json(
        { error: 'Flow log query timed out' },
        {
          status: 504,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    if (error.statusCode === 503 || error.code === 'CONNECTION_ERROR') {
      return NextResponse.json(
        { error: 'Unable to connect to flow log backend' },
        {
          status: 503,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    if (error.code === 'VALIDATION_ERROR') {
      return NextResponse.json(
        { error: 'Invalid response from flow log backend' },
        {
          status: 502,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    return NextResponse.json(
      { error: 'Failed to query flow logs' },
      {
        status: error.statusCode >= 500 ? 502 : error.statusCode,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }

  childLogger.error({ error }, 'Unexpected error querying flow logs');

  return NextResponse.json(
    { error: 'Internal server error' },
    {
      status: 500,
      headers: { 'X-Request-ID': requestId },
    }
  );
}
