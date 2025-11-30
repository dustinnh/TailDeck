/**
 * Headscale Nodes API Route
 *
 * Proxies authenticated requests to the Headscale API.
 * This route follows the BFF (Backend-for-Frontend) pattern where
 * the browser never directly contacts Headscale.
 *
 * Security:
 * - Requires authentication via Auth.js session
 * - Role-based access control
 * - Validates all responses with Zod schemas
 * - Logs all access for audit purposes
 * - Never exposes Headscale credentials to the client
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';

/**
 * GET /api/headscale/nodes
 *
 * Returns a list of all nodes in Headscale.
 * Requires USER role or higher.
 */
export const GET = withRoles(
  ['USER', 'AUDITOR', 'OPERATOR', 'ADMIN', 'OWNER'],
  async (_req, ctx) => {
    const requestId = crypto.randomUUID();
    const childLogger = logger.child({
      requestId,
      endpoint: '/api/headscale/nodes',
    });

    try {
      // Log the authenticated request for audit
      childLogger.info(
        { userId: ctx.user.id, userEmail: ctx.user.email },
        'Authenticated request to list nodes'
      );

      // Fetch nodes from Headscale
      const client = getHeadscaleClient();
      const response = await client.listNodes();

      childLogger.debug({ nodeCount: response.nodes.length }, 'Successfully fetched nodes');

      return NextResponse.json(response, {
        headers: {
          'X-Request-ID': requestId,
        },
      });
    } catch (error) {
      return handleHeadscaleError(error, childLogger, requestId);
    }
  }
);

/**
 * Helper to handle Headscale API errors consistently
 */
function handleHeadscaleError(error: unknown, childLogger: typeof logger, requestId: string) {
  if (error instanceof HeadscaleClientError) {
    childLogger.error(
      { statusCode: error.statusCode, code: error.code },
      `Headscale API error: ${error.message}`
    );

    if (error.statusCode === 504 || error.code === 'TIMEOUT') {
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        {
          status: 503,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    if (error.statusCode === 503 || error.code === 'CONNECTION_ERROR') {
      return NextResponse.json(
        { error: 'Unable to connect to Headscale' },
        {
          status: 503,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    return NextResponse.json(
      { error: 'Failed to complete operation' },
      {
        status: 502,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }

  childLogger.error({ error }, 'Unexpected error');

  return NextResponse.json(
    { error: 'Internal server error' },
    {
      status: 500,
      headers: { 'X-Request-ID': requestId },
    }
  );
}
