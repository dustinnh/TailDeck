/**
 * Route Disable API
 *
 * POST - Disable a route (OPERATOR+)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles, type AuthenticatedContext } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * POST /api/headscale/routes/[id]/disable
 * Disable a route
 */
export const POST = withRoles(
  ['OPERATOR', 'ADMIN', 'OWNER'],
  async (req: NextRequest, ctx: AuthenticatedContext) => {
    const requestId = crypto.randomUUID();
    const params = await ctx.params;
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Route ID required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    const childLogger = logger.child({
      requestId,
      endpoint: `/api/headscale/routes/${id}/disable`,
    });

    try {
      const client = getHeadscaleClient();
      const response = await client.disableRoute(id);

      await logAudit({
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        actorIp: getClientIp(req.headers),
        action: 'DISABLE_ROUTE',
        resourceType: 'ROUTE',
        resourceId: id,
        newValue: { enabled: false },
        metadata: {
          prefix: response.route.prefix,
          nodeId: response.route.node.id,
          nodeName: response.route.node.givenName,
        },
      });

      childLogger.info(
        { userId: ctx.user.id, routeId: id, prefix: response.route.prefix },
        'Route disabled'
      );

      return NextResponse.json(response, {
        headers: { 'X-Request-ID': requestId },
      });
    } catch (error) {
      if (error instanceof HeadscaleClientError) {
        if (error.statusCode === 404) {
          return NextResponse.json(
            { error: 'Route not found' },
            { status: 404, headers: { 'X-Request-ID': requestId } }
          );
        }
      }
      childLogger.error({ error }, 'Failed to disable route');
      return NextResponse.json(
        { error: 'Failed to disable route' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  }
);
