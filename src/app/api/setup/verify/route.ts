import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkService } from '@/server/services/diagnostics';

/**
 * POST /api/setup/verify
 *
 * Verify specific configuration settings
 * Requires: Authenticated user
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const verifySchema = z.object({
      type: z.enum(['url', 'dns', 'service']),
      value: z.string().optional(),
      service: z.enum(['database', 'headscale', 'oidc']).optional(),
    });

    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, value, service } = parsed.data;

    switch (type) {
      case 'url': {
        if (!value) {
          return NextResponse.json({ error: 'URL value is required' }, { status: 400 });
        }

        // Verify URL is accessible
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(value, {
            method: 'HEAD',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          return NextResponse.json({
            verified: true,
            statusCode: response.status,
            message: response.ok ? 'URL is accessible' : `URL returned ${response.status}`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json({
            verified: false,
            message: `URL verification failed: ${message}`,
          });
        }
      }

      case 'dns': {
        if (!value) {
          return NextResponse.json({ error: 'Domain value is required' }, { status: 400 });
        }

        // For DNS verification, we try to fetch the domain
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const url = value.startsWith('http') ? value : `https://${value}`;
          await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          return NextResponse.json({
            verified: true,
            message: 'Domain resolves correctly',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';

          // Check if it's a DNS resolution error
          if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
            return NextResponse.json({
              verified: false,
              message: 'Domain does not resolve',
            });
          }

          // Other errors might mean the domain resolves but the server isn't responding
          return NextResponse.json({
            verified: true,
            message: 'Domain resolves (server may not be responding)',
          });
        }
      }

      case 'service': {
        if (!service) {
          return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
        }

        const health = await checkService(service);

        return NextResponse.json({
          verified: health.status === 'healthy',
          status: health.status,
          message: health.message,
          latencyMs: health.latencyMs,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown verification type' }, { status: 400 });
    }
  } catch (error) {
    logger.error({ error }, 'Verification failed');
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
