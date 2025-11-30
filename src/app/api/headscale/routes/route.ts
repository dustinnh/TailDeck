/**
 * Routes API Route
 *
 * GET - List all routes (USER+)
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';

/**
 * GET /api/headscale/routes
 * List all routes
 */
export const GET = withRoles(
  ['USER', 'AUDITOR', 'OPERATOR', 'ADMIN', 'OWNER'],
  async (_req, ctx) => {
    const requestId = crypto.randomUUID();
    const childLogger = logger.child({
      requestId,
      endpoint: '/api/headscale/routes',
    });

    try {
      childLogger.info(
        { userId: ctx.user.id, userEmail: ctx.user.email },
        'Authenticated request to list routes'
      );

      const client = getHeadscaleClient();
      const response = await client.listRoutes();

      childLogger.debug({ routeCount: response.routes.length }, 'Successfully fetched routes');

      return NextResponse.json(response, {
        headers: { 'X-Request-ID': requestId },
      });
    } catch (error) {
      if (error instanceof HeadscaleClientError) {
        childLogger.error(
          { statusCode: error.statusCode, code: error.code },
          `Headscale API error: ${error.message}`
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch routes' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  }
);
