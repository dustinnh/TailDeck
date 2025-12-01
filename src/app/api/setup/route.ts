import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getSetupStatus, completeSetup, resetSetup, dismissWarning } from '@/server/services/setup';

/**
 * GET /api/setup
 *
 * Get current setup status
 * Requires: Authenticated user
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getSetupStatus();

    return NextResponse.json(status);
  } catch (error) {
    logger.error({ error }, 'Failed to get setup status');
    return NextResponse.json({ error: 'Failed to get setup status' }, { status: 500 });
  }
}

/**
 * POST /api/setup
 *
 * Mark setup as complete or perform other setup actions
 * Requires: OWNER role
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for OWNER role
    const userRoles = (session.user as { roles?: string[] }).roles || [];
    if (!userRoles.includes('OWNER')) {
      return NextResponse.json({ error: 'Only OWNER can complete setup' }, { status: 403 });
    }

    const body = await request.json();

    // Parse action
    const actionSchema = z.object({
      action: z.enum(['complete', 'reset', 'dismiss-warning']),
      warningId: z.string().optional(),
    });

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, warningId } = parsed.data;

    switch (action) {
      case 'complete': {
        const result = await completeSetup(session.user.id);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, message: 'Setup completed' });
      }

      case 'reset': {
        const result = await resetSetup();
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, message: 'Setup reset' });
      }

      case 'dismiss-warning': {
        if (!warningId) {
          return NextResponse.json(
            { error: 'warningId is required for dismiss-warning action' },
            { status: 400 }
          );
        }
        const result = await dismissWarning(warningId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, message: 'Warning dismissed' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    logger.error({ error }, 'Setup action failed');
    return NextResponse.json({ error: 'Setup action failed' }, { status: 500 });
  }
}
