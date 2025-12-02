import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { runDiagnostics, checkService } from '@/server/services/diagnostics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/setup/diagnostics
 *
 * Get comprehensive system diagnostics
 * Requires: Authenticated user
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for optional service parameter
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service') as 'database' | 'headscale' | 'oidc' | null;

    if (service) {
      // Check specific service
      const validServices = ['database', 'headscale', 'oidc'];
      if (!validServices.includes(service)) {
        return NextResponse.json(
          { error: `Invalid service. Must be one of: ${validServices.join(', ')}` },
          { status: 400 }
        );
      }

      const health = await checkService(service);
      return NextResponse.json(health);
    }

    // Full diagnostics
    const diagnostics = await runDiagnostics();

    return NextResponse.json(diagnostics);
  } catch (error) {
    logger.error({ error }, 'Failed to run diagnostics');
    return NextResponse.json({ error: 'Failed to run diagnostics' }, { status: 500 });
  }
}
