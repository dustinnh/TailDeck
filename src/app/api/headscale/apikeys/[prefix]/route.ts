/**
 * Headscale API Key Individual Route
 *
 * Operations on individual API keys by prefix.
 * Security: Requires OWNER role only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * DELETE /api/headscale/apikeys/[prefix]
 *
 * Deletes an API key by prefix.
 * Requires OWNER role.
 */
export const DELETE = withRoles(['OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  // Extract prefix from URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const prefix = pathParts[pathParts.length - 1];

  const childLogger = logger.child({
    requestId,
    endpoint: `/api/headscale/apikeys/${prefix}`,
  });

  try {
    if (!prefix) {
      return NextResponse.json(
        { error: 'API key prefix is required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email, prefix },
      'Authenticated request to delete API key'
    );

    const client = getHeadscaleClient();
    await client.deleteApiKey(prefix);

    // Log audit event
    await logAudit({
      action: 'DELETE_API_KEY',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'API_KEY',
      resourceId: prefix,
      metadata: {},
    });

    childLogger.info({ prefix }, 'Successfully deleted API key');

    return NextResponse.json({ success: true }, { headers: { 'X-Request-ID': requestId } });
  } catch (error) {
    return handleHeadscaleError(error, childLogger, requestId);
  }
});

/**
 * POST /api/headscale/apikeys/[prefix]
 *
 * Expires an API key by prefix (alternative to delete).
 * Requires OWNER role.
 */
export const POST = withRoles(['OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  // Extract prefix from URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const prefix = pathParts[pathParts.length - 1];

  const childLogger = logger.child({
    requestId,
    endpoint: `/api/headscale/apikeys/${prefix}`,
  });

  try {
    if (!prefix) {
      return NextResponse.json(
        { error: 'API key prefix is required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email, prefix },
      'Authenticated request to expire API key'
    );

    const client = getHeadscaleClient();
    await client.expireApiKey(prefix);

    // Log audit event
    await logAudit({
      action: 'EXPIRE_API_KEY',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'API_KEY',
      resourceId: prefix,
      metadata: {},
    });

    childLogger.info({ prefix }, 'Successfully expired API key');

    return NextResponse.json({ success: true }, { headers: { 'X-Request-ID': requestId } });
  } catch (error) {
    return handleHeadscaleError(error, childLogger, requestId);
  }
});

function handleHeadscaleError(error: unknown, childLogger: typeof logger, requestId: string) {
  if (error instanceof HeadscaleClientError) {
    childLogger.error(
      { statusCode: error.statusCode, code: error.code },
      `Headscale API error: ${error.message}`
    );

    if (error.statusCode === 504 || error.code === 'TIMEOUT') {
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503, headers: { 'X-Request-ID': requestId } }
      );
    }

    if (error.statusCode === 503 || error.code === 'CONNECTION_ERROR') {
      return NextResponse.json(
        { error: 'Unable to connect to Headscale' },
        { status: 503, headers: { 'X-Request-ID': requestId } }
      );
    }

    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404, headers: { 'X-Request-ID': requestId } }
      );
    }

    if (error.statusCode === 400) {
      return NextResponse.json(
        { error: error.message || 'Invalid request' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    return NextResponse.json(
      { error: 'Failed to complete operation' },
      { status: 502, headers: { 'X-Request-ID': requestId } }
    );
  }

  childLogger.error({ error }, 'Unexpected error');

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500, headers: { 'X-Request-ID': requestId } }
  );
}
