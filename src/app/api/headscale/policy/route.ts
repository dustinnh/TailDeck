/**
 * Headscale Policy API Route
 *
 * Manages ACL policies in Headscale.
 * Security: Requires ADMIN role to read, ADMIN to write.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * GET /api/headscale/policy
 *
 * Returns the current ACL policy.
 * Requires ADMIN role or higher.
 */
export const GET = withRoles(['ADMIN', 'OWNER'], async (_req, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/policy',
  });

  try {
    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email },
      'Authenticated request to get policy'
    );

    const client = getHeadscaleClient();
    const response = await client.getPolicy();

    return NextResponse.json(response, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    return handleHeadscaleError(error, childLogger, requestId);
  }
});

/**
 * PUT /api/headscale/policy
 *
 * Updates the ACL policy.
 * Requires ADMIN role or higher.
 */
export const PUT = withRoles(['ADMIN', 'OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/policy',
  });

  try {
    const body = await req.json();
    const { policy } = body as { policy: string };

    if (!policy || typeof policy !== 'string') {
      return NextResponse.json(
        { error: 'Policy content is required and must be a string' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Validate JSON before sending to Headscale
    try {
      JSON.parse(policy);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in policy' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email },
      'Authenticated request to update policy'
    );

    const client = getHeadscaleClient();
    const response = await client.setPolicy(policy);

    // Log audit event
    await logAudit({
      action: 'UPDATE_ACL',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'ACL',
      resourceId: 'policy',
      metadata: {
        policyLength: policy.length,
      },
    });

    childLogger.info('Successfully updated ACL policy');

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

    // For 400 errors from Headscale (invalid policy), forward the error
    if (error.statusCode === 400) {
      return NextResponse.json(
        { error: error.message || 'Invalid policy' },
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
