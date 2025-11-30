/**
 * Headscale Metrics API Endpoint
 *
 * Proxies Prometheus metrics from Headscale through the BFF pattern.
 * Parses and returns structured metrics data for dashboard visualization.
 *
 * Security:
 * - Requires authentication (any authenticated user can access)
 * - Uses BFF pattern - metrics URL never exposed to client
 */

import { NextResponse } from 'next/server';

import { fetchHeadscaleMetrics } from '@/server/headscale/metrics';
import { withMinimumRole } from '@/server/middleware/require-role';

/**
 * GET /api/headscale/metrics
 *
 * Returns parsed Headscale metrics for dashboard visualization.
 * Requires authentication (USER role minimum = all authenticated users).
 */
export const GET = withMinimumRole('USER', async () => {
  const metrics = await fetchHeadscaleMetrics();

  return NextResponse.json(metrics, {
    headers: {
      // Short cache to allow frequent refreshes but avoid hammering the endpoint
      'Cache-Control': 'private, max-age=10',
    },
  });
});
