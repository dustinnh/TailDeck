/**
 * Headscale PreAuth Keys API Route
 *
 * Create and manage preauth keys for device registration.
 * Security: Requires OPERATOR role or higher.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * GET /api/headscale/keys
 *
 * List preauth keys for a user.
 * Query param: user (required)
 */
export const GET = withRoles(['OPERATOR', 'ADMIN', 'OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/keys',
  });

  try {
    const url = new URL(req.url);
    const user = url.searchParams.get('user');

    if (!user) {
      return NextResponse.json(
        { error: 'user query parameter is required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.info({ userId: ctx.user.id, headscaleUser: user }, 'Listing preauth keys');

    const client = getHeadscaleClient();
    const response = await client.listPreAuthKeys(user);

    return NextResponse.json(response, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    return handleHeadscaleError(error, childLogger, requestId);
  }
});

/**
 * POST /api/headscale/keys
 *
 * Create a new preauth key.
 */
export const POST = withRoles(['OPERATOR', 'ADMIN', 'OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/keys',
  });

  try {
    const body = await req.json();
    const {
      user,
      reusable = false,
      ephemeral = false,
      expiration,
      aclTags,
    } = body as {
      user: string;
      reusable?: boolean;
      ephemeral?: boolean;
      expiration?: string;
      aclTags?: string[];
    };

    if (!user) {
      return NextResponse.json(
        { error: 'user is required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.info(
      { userId: ctx.user.id, headscaleUser: user, reusable, ephemeral },
      'Creating preauth key'
    );

    const client = getHeadscaleClient();
    const response = await client.createPreAuthKey({
      user,
      reusable,
      ephemeral,
      expiration,
      aclTags,
    });

    // Log audit event
    await logAudit({
      action: 'CREATE_KEY',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'KEY',
      resourceId: response.preAuthKey.id,
      metadata: {
        headscaleUser: user,
        reusable,
        ephemeral,
        aclTags,
      },
    });

    childLogger.info('Successfully created preauth key');

    return NextResponse.json(response, {
      headers: { 'X-Request-ID': requestId },
    });
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

    return NextResponse.json(
      { error: error.message || 'Failed to complete operation' },
      { status: error.statusCode || 502, headers: { 'X-Request-ID': requestId } }
    );
  }

  childLogger.error({ error }, 'Unexpected error');

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500, headers: { 'X-Request-ID': requestId } }
  );
}
