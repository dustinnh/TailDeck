/**
 * Node Expire API Route
 *
 * POST - Expire a node (forces re-authentication) (OPERATOR+)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles, type AuthenticatedContext } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * POST /api/headscale/nodes/[id]/expire
 * Expire a node (forces re-authentication)
 */
export const POST = withRoles(
  ['OPERATOR', 'ADMIN', 'OWNER'],
  async (req: NextRequest, ctx: AuthenticatedContext) => {
    const requestId = crypto.randomUUID();
    const params = await ctx.params;
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    const childLogger = logger.child({
      requestId,
      endpoint: `/api/headscale/nodes/${id}/expire`,
    });

    try {
      const client = getHeadscaleClient();

      // Get current node state for audit
      const currentNode = await client.getNode(id);
      const response = await client.expireNode(id);

      await logAudit({
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        actorIp: getClientIp(req.headers),
        action: 'EXPIRE_NODE',
        resourceType: 'NODE',
        resourceId: id,
        oldValue: { expiry: currentNode.node.expiry },
        newValue: { expiry: response.node.expiry },
        metadata: { nodeName: currentNode.node.givenName },
      });

      childLogger.info(
        { userId: ctx.user.id, nodeId: id, nodeName: currentNode.node.givenName },
        'Node expired'
      );

      return NextResponse.json(response, {
        headers: { 'X-Request-ID': requestId },
      });
    } catch (error) {
      if (error instanceof HeadscaleClientError) {
        if (error.statusCode === 404) {
          return NextResponse.json(
            { error: 'Node not found' },
            { status: 404, headers: { 'X-Request-ID': requestId } }
          );
        }
      }
      childLogger.error({ error }, 'Failed to expire node');
      return NextResponse.json(
        { error: 'Failed to expire node' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  }
);
