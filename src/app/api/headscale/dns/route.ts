/**
 * Headscale DNS API Route
 *
 * Manages DNS configuration in Headscale.
 * Security: Requires ADMIN role to read and write.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withRoles } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * GET /api/headscale/dns
 *
 * Returns the current DNS configuration.
 * Requires ADMIN role or higher.
 */
export const GET = withRoles(['ADMIN', 'OWNER'], async (_req, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/dns',
  });

  try {
    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email },
      'Authenticated request to get DNS configuration'
    );

    const client = getHeadscaleClient();
    const response = await client.getDNS();

    return NextResponse.json(response, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    return handleHeadscaleError(error, childLogger, requestId);
  }
});

/**
 * PUT /api/headscale/dns
 *
 * Updates the DNS configuration.
 * Requires ADMIN role or higher.
 */
export const PUT = withRoles(['ADMIN', 'OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    endpoint: '/api/headscale/dns',
  });

  try {
    const body = await req.json();
    const { nameservers, domains, magicDNS, baseDomain } = body as {
      nameservers?: string[];
      domains?: string[];
      magicDNS?: boolean;
      baseDomain?: string;
    };

    childLogger.info(
      { userId: ctx.user.id, userEmail: ctx.user.email },
      'Authenticated request to update DNS configuration'
    );

    const client = getHeadscaleClient();
    const response = await client.setDNS({
      nameservers,
      domains,
      magicDNS,
      baseDomain,
    });

    // Log audit event
    await logAudit({
      action: 'UPDATE_DNS',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'DNS',
      resourceId: 'config',
      metadata: {
        nameserversCount: nameservers?.length ?? 0,
        domainsCount: domains?.length ?? 0,
        magicDNS,
        baseDomain,
      },
    });

    childLogger.info('Successfully updated DNS configuration');

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

    if (error.statusCode === 400) {
      return NextResponse.json(
        { error: error.message || 'Invalid DNS configuration' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    if (error.statusCode === 404 || error.message?.includes('Not Found')) {
      return NextResponse.json(
        { error: 'Not Found - DNS API not available in this Headscale version' },
        { status: 404, headers: { 'X-Request-ID': requestId } }
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
