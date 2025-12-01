/**
 * Flow Logs Label Values API Route
 *
 * Returns available values for a specific label.
 * Used by the UI to populate filter dropdowns.
 *
 * Security:
 * - Requires authentication via Auth.js session
 * - Requires AUDITOR role or higher
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { getFlowLogProvider, isFlowLoggingEnabled, LokiClientError } from '@/server/flowlogs';
import { withMinimumRole, type AuthenticatedContext } from '@/server/middleware/require-role';

/**
 * GET /api/flowlogs/labels/[name]
 *
 * Returns all values for a specific label.
 * Requires AUDITOR role or higher.
 *
 * Path Parameters:
 * - name: The label name to get values for
 *
 * Query Parameters:
 * - start: Start time (ISO 8601 or Unix timestamp)
 * - end: End time (ISO 8601 or Unix timestamp)
 */
export const GET = withMinimumRole(
  'AUDITOR',
  async (req: NextRequest, ctx: AuthenticatedContext) => {
    const requestId = crypto.randomUUID();
    const resolvedParams = await ctx.params;
    const labelName = resolvedParams.name;

    const childLogger = logger.child({
      requestId,
      endpoint: `/api/flowlogs/labels/${labelName}`,
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

    // Validate label name
    if (!labelName || typeof labelName !== 'string') {
      return NextResponse.json(
        { error: 'Invalid label name' },
        {
          status: 400,
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
          labelName,
          timeRange: timeRange
            ? { start: timeRange.start.toISOString(), end: timeRange.end.toISOString() }
            : 'default',
        },
        'Authenticated request to get flow log label values'
      );

      const provider = getFlowLogProvider();
      const response = await provider.getLabelValues(labelName, timeRange);

      childLogger.debug(
        { labelName, valueCount: response.labels.length },
        'Successfully fetched label values'
      );

      return NextResponse.json(response, {
        headers: {
          'X-Request-ID': requestId,
        },
      });
    } catch (error) {
      if (error instanceof LokiClientError) {
        childLogger.error(
          { statusCode: error.statusCode, code: error.code, labelName },
          `Flow log label values error: ${error.message}`
        );

        return NextResponse.json(
          { error: 'Failed to fetch label values' },
          {
            status: error.statusCode >= 500 ? 502 : error.statusCode,
            headers: { 'X-Request-ID': requestId },
          }
        );
      }

      childLogger.error({ error, labelName }, 'Unexpected error fetching label values');

      return NextResponse.json(
        { error: 'Internal server error' },
        {
          status: 500,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }
  }
);
