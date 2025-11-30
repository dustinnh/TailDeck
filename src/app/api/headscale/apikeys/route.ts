/**
 * Headscale API Keys Route
 *
 * Manages Headscale API keys.
 * Security: Requires OWNER role only - these keys have full Headscale access.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * GET /api/headscale/apikeys
 *
 * Lists all API keys.
 * Requires OWNER role.
 */
export const GET = withRoles(['OWNER'], async (_req, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/apikeys',
  });

  try {
    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email },
      'Authenticated request to list API keys'
    );

    const client = getHeadscaleClient();
    const response = await client.listApiKeys();

    return NextResponse.json(response, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    return handleHeadscaleError(error, childLogger, requestId);
  }
});

/**
 * POST /api/headscale/apikeys
 *
 * Creates a new API key.
 * Requires OWNER role.
 *
 * Body: { expiration?: string } (ISO date)
 * Returns: { apiKey: string } - The full key (only shown once!)
 */
export const POST = withRoles(['OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/apikeys',
  });

  try {
    const body = await req.json().catch(() => ({}));
    const { expiration } = body as { expiration?: string };

    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email, hasExpiration: !!expiration },
      'Authenticated request to create API key'
    );

    const client = getHeadscaleClient();
    const response = await client.createApiKey(expiration ? { expiration } : undefined);

    // Log audit event - don't log the actual key for security
    await logAudit({
      action: 'CREATE_API_KEY',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'API_KEY',
      resourceId: 'new',
      metadata: {
        hasExpiration: !!expiration,
        expiration: expiration ?? null,
      },
    });

    childLogger.info('Successfully created API key');

    return NextResponse.json(response, {
      status: 201,
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

    if (error.statusCode === 400) {
      return NextResponse.json(
        { error: error.message || 'Invalid request' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
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
