/**
 * Headscale Users API Route
 *
 * List Headscale users/namespaces.
 * Security: Requires OPERATOR role or higher.
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';

/**
 * GET /api/headscale/users
 *
 * List all Headscale users/namespaces.
 */
export const GET = withRoles(['OPERATOR', 'ADMIN', 'OWNER'], async (_req, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/users',
  });

  try {
    childLogger.info({ userId: ctx.user.id }, 'Listing Headscale users');

    const client = getHeadscaleClient();
    const response = await client.listUsers();

    return NextResponse.json(response, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    if (error instanceof HeadscaleClientError) {
      childLogger.error(
        { statusCode: error.statusCode, code: error.code },
        `Headscale API error: ${error.message}`
      );

      return NextResponse.json(
        { error: error.message || 'Failed to fetch users' },
        { status: error.statusCode || 502, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.error({ error }, 'Unexpected error');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    );
  }
});
