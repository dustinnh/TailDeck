/**
 * Headscale Bulk Node Operations Route
 *
 * Performs bulk operations on multiple nodes.
 * Security:
 * - delete: Requires ADMIN role
 * - expire, move, tags: Requires OPERATOR role
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { bulkOperationRequestSchema } from '@/server/headscale/schemas';
import type { BulkOperationResult, BulkAction } from '@/server/headscale/types';
import { withRoles } from '@/server/middleware/require-role';
import { logAudit, getClientIp, type AuditAction } from '@/server/services/audit';

// Map bulk actions to audit action types
const BULK_AUDIT_ACTIONS: Record<BulkAction, AuditAction> = {
  delete: 'BULK_DELETE',
  expire: 'BULK_EXPIRE',
  move: 'BULK_MOVE',
  tags: 'BULK_TAGS',
};

// Role requirements per action
const ACTION_ROLES: Record<BulkAction, string[]> = {
  delete: ['ADMIN', 'OWNER'],
  expire: ['OPERATOR', 'ADMIN', 'OWNER'],
  move: ['OPERATOR', 'ADMIN', 'OWNER'],
  tags: ['OPERATOR', 'ADMIN', 'OWNER'],
};

/**
 * POST /api/headscale/nodes/bulk
 *
 * Performs bulk operations on multiple nodes.
 *
 * Body: {
 *   action: 'delete' | 'expire' | 'move' | 'tags',
 *   nodeIds: string[],
 *   newUser?: string,  // for 'move'
 *   tags?: string[],   // for 'tags'
 * }
 */
export const POST = withRoles(['OPERATOR', 'ADMIN', 'OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/nodes/bulk',
  });

  try {
    const body = await req.json();

    // Validate request body
    const validationResult = bulkOperationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.flatten(),
        },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    const { action, nodeIds, newUser, tags } = validationResult.data;

    // Check role requirements for specific action
    const userRoles = ctx.user.roles as string[];
    const requiredRoles = ACTION_ROLES[action];
    const hasRequiredRole = userRoles.some((role) => requiredRoles.includes(role));

    if (!hasRequiredRole) {
      childLogger.warn(
        {
          userId: ctx.user.id,
          action,
          userRoles,
          requiredRoles,
        },
        'Insufficient permissions for bulk action'
      );
      return NextResponse.json(
        { error: `Insufficient permissions for ${action} action` },
        { status: 403, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.info(
      {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        action,
        nodeCount: nodeIds.length,
      },
      'Authenticated request for bulk operation'
    );

    const client = getHeadscaleClient();
    const results: BulkOperationResult[] = [];

    // Process each node
    for (const nodeId of nodeIds) {
      try {
        switch (action) {
          case 'delete':
            await client.deleteNode(nodeId);
            break;
          case 'expire':
            await client.expireNode(nodeId);
            break;
          case 'move':
            if (!newUser) throw new Error('newUser is required for move action');
            await client.moveNode(nodeId, newUser);
            break;
          case 'tags':
            if (!tags) throw new Error('tags is required for tags action');
            await client.setNodeTags(nodeId, tags);
            break;
        }
        results.push({ nodeId, success: true });
      } catch (error) {
        const errorMessage =
          error instanceof HeadscaleClientError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Unknown error';
        results.push({ nodeId, success: false, error: errorMessage });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Log audit event
    await logAudit({
      action: BULK_AUDIT_ACTIONS[action],
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'NODE',
      resourceId: nodeIds.join(','),
      metadata: {
        action,
        nodeCount: nodeIds.length,
        succeeded,
        failed,
        newUser: newUser ?? null,
        tags: tags ?? null,
      },
    });

    childLogger.info(
      { action, total: nodeIds.length, succeeded, failed },
      'Bulk operation completed'
    );

    return NextResponse.json(
      {
        results,
        summary: {
          total: nodeIds.length,
          succeeded,
          failed,
        },
      },
      { headers: { 'X-Request-ID': requestId } }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.error({ error }, 'Unexpected error in bulk operation');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    );
  }
});
