import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getPublicConfig } from '@/server/services/config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/config
 *
 * Get public configuration values safe to expose to clients.
 * No authentication required - only returns safe values.
 */
export async function GET() {
  try {
    const config = getPublicConfig();
    return NextResponse.json(config);
  } catch (error) {
    logger.error({ error }, 'Failed to get public config');
    return NextResponse.json({ error: 'Failed to get configuration' }, { status: 500 });
  }
}
