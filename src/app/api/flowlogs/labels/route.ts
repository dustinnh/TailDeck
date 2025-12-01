/**
 * Flow Logs Labels API Route
 *
 * Returns available label names and values from the flow log backend.
 * Used by the UI to populate filter dropdowns.
 *
 * Security:
 * - Requires authentication via Auth.js session
 * - Requires AUDITOR role or higher
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { getFlowLogProvider, isFlowLoggingEnabled, LokiClientError } from '@/server/flowlogs';
import { withMinimumRole } from '@/server/middleware/require-role';

/**
 * GET /api/flowlogs/labels
 *
 * Returns all available label names.
 * Requires AUDITOR role or higher.
 *
 * Query Parameters:
 * - start: Start time (ISO 8601 or Unix timestamp)
 * - end: End time (ISO 8601 or Unix timestamp)
 */
export const GET = withMinimumRole('AUDITOR', async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/flowlogs/labels',
  });

  // Check if flow logging is enabled
  if (!isFlowLoggingEnabled()) {
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
    // Parse query parameters for optional time range
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const timeRange =
      start && end
        ? {
            start: new Date(start),
            end: new Date(end),
          }
        : undefined;

    childLogger.info(
      {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        timeRange: timeRange
          ? { start: timeRange.start.toISOString(), end: timeRange.end.toISOString() }
          : 'default',
      },
      'Authenticated request to get flow log labels'
    );

    const provider = getFlowLogProvider();
    const response = await provider.getLabels(timeRange);

    childLogger.debug({ labelCount: response.labels.length }, 'Successfully fetched labels');

    return NextResponse.json(response, {
      headers: {
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    if (error instanceof LokiClientError) {
      childLogger.error(
        { statusCode: error.statusCode, code: error.code },
        `Flow log labels error: ${error.message}`
      );

      return NextResponse.json(
        { error: 'Failed to fetch labels' },
        {
          status: error.statusCode >= 500 ? 502 : error.statusCode,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    childLogger.error({ error }, 'Unexpected error fetching labels');

    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }
});
