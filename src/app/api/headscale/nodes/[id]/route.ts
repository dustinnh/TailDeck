/**
 * Individual Node API Route
 *
 * GET - Get node details (USER+)
 * PATCH - Update node (rename, tags) (OPERATOR+)
 * DELETE - Delete node (ADMIN+)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles, type AuthenticatedContext } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

const updateNodeSchema = z.object({
  givenName: z.string().min(1).max(253).optional(),
  tags: z.array(z.string().regex(/^tag:/)).optional(),
  user: z.string().min(1).optional(),
  expiry: z.string().datetime().optional(),
});

/**
 * GET /api/headscale/nodes/[id]
 * Get a single node by ID
 */
export const GET = withRoles(
  ['USER', 'AUDITOR', 'OPERATOR', 'ADMIN', 'OWNER'],
  async (_req: NextRequest, ctx: AuthenticatedContext) => {
    const requestId = crypto.randomUUID();
    const params = await ctx.params;
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    try {
      const client = getHeadscaleClient();
      const response = await client.getNode(id);

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
      return NextResponse.json(
        { error: 'Failed to fetch node' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  }
);

/**
 * PATCH /api/headscale/nodes/[id]
 * Update node (rename and/or update tags)
 */
export const PATCH = withRoles(
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
      endpoint: `/api/headscale/nodes/${id}`,
    });

    try {
      const body = await req.json();
      const parsed = updateNodeSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: parsed.error.flatten() },
          { status: 400, headers: { 'X-Request-ID': requestId } }
        );
      }

      const client = getHeadscaleClient();

      // Get current node state for audit
      const currentNode = await client.getNode(id);
      let response = currentNode;

      // Handle rename
      if (parsed.data.givenName) {
        response = await client.renameNode(id, parsed.data.givenName);

        await logAudit({
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          actorIp: getClientIp(req.headers),
          action: 'RENAME_NODE',
          resourceType: 'NODE',
          resourceId: id,
          oldValue: { givenName: currentNode.node.givenName },
          newValue: { givenName: parsed.data.givenName },
        });

        childLogger.info(
          { userId: ctx.user.id, nodeId: id, newName: parsed.data.givenName },
          'Node renamed'
        );
      }

      // Handle tags update
      if (parsed.data.tags) {
        response = await client.setNodeTags(id, parsed.data.tags);

        await logAudit({
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          actorIp: getClientIp(req.headers),
          action: 'UPDATE_TAGS',
          resourceType: 'NODE',
          resourceId: id,
          oldValue: { tags: currentNode.node.forcedTags },
          newValue: { tags: parsed.data.tags },
        });

        childLogger.info(
          { userId: ctx.user.id, nodeId: id, tags: parsed.data.tags },
          'Node tags updated'
        );
      }

      // Handle move to different user
      if (parsed.data.user) {
        response = await client.moveNode(id, parsed.data.user);

        await logAudit({
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          actorIp: getClientIp(req.headers),
          action: 'MOVE_NODE',
          resourceType: 'NODE',
          resourceId: id,
          oldValue: { user: currentNode.node.user?.name },
          newValue: { user: parsed.data.user },
        });

        childLogger.info(
          { userId: ctx.user.id, nodeId: id, newUser: parsed.data.user },
          'Node moved to new user'
        );
      }

      // Handle expiry update
      if (parsed.data.expiry) {
        response = await client.setNodeExpiry(id, parsed.data.expiry);

        await logAudit({
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          actorIp: getClientIp(req.headers),
          action: 'EXPIRE_NODE',
          resourceType: 'NODE',
          resourceId: id,
          oldValue: { expiry: currentNode.node.expiry },
          newValue: { expiry: parsed.data.expiry },
          metadata: { type: 'set_expiry' },
        });

        childLogger.info(
          { userId: ctx.user.id, nodeId: id, expiry: parsed.data.expiry },
          'Node expiry updated'
        );
      }

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
      childLogger.error({ error }, 'Failed to update node');
      return NextResponse.json(
        { error: 'Failed to update node' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  }
);

/**
 * DELETE /api/headscale/nodes/[id]
 * Delete a node
 */
export const DELETE = withRoles(
  ['ADMIN', 'OWNER'],
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
      endpoint: `/api/headscale/nodes/${id}`,
    });

    try {
      const client = getHeadscaleClient();

      // Get current node for audit before deletion
      const currentNode = await client.getNode(id);

      await client.deleteNode(id);

      await logAudit({
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        actorIp: getClientIp(req.headers),
        action: 'DELETE_NODE',
        resourceType: 'NODE',
        resourceId: id,
        oldValue: currentNode.node,
        metadata: { nodeName: currentNode.node.givenName },
      });

      childLogger.info(
        { userId: ctx.user.id, nodeId: id, nodeName: currentNode.node.givenName },
        'Node deleted'
      );

      return NextResponse.json({ success: true }, { headers: { 'X-Request-ID': requestId } });
    } catch (error) {
      if (error instanceof HeadscaleClientError) {
        if (error.statusCode === 404) {
          return NextResponse.json(
            { error: 'Node not found' },
            { status: 404, headers: { 'X-Request-ID': requestId } }
          );
        }
      }
      childLogger.error({ error }, 'Failed to delete node');
      return NextResponse.json(
        { error: 'Failed to delete node' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  }
);
