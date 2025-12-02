/**
 * Network Health API Endpoint
 *
 * Aggregates health data from database, Headscale API, and derives
 * node/route health metrics. Returns comprehensive network status.
 *
 * Security:
 * - Requires authentication (any authenticated user can access)
 * - Uses BFF pattern - Headscale credentials never exposed to client
 */

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';
import { withMinimumRole } from '@/server/middleware/require-role';

// Constants for health calculations
const EXPIRY_WARNING_DAYS = 7;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ServiceStatus {
  status: 'ok' | 'error' | 'unconfigured';
  latencyMs?: number;
  message?: string;
}

interface NodeMetrics {
  total: number;
  online: number;
  offline: number;
  expiringSoon: number;
  stale: number;
}

interface RouteMetrics {
  total: number;
  enabled: number;
  disabled: number;
  exitNodes: {
    total: number;
    enabled: number;
  };
  orphaned: number;
}

interface UserMetrics {
  total: number;
  withNodes: number;
}

interface NetworkHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  lastUpdated: string;
  services: {
    database: ServiceStatus;
    headscale: ServiceStatus;
  };
  nodes: NodeMetrics;
  routes: RouteMetrics;
  users: UserMetrics;
}

/**
 * Parse Headscale timestamp to Date
 */
function parseTimestamp(ts: { seconds: string; nanos: number }): Date {
  return new Date(parseInt(ts.seconds, 10) * 1000);
}

/**
 * Calculate node health metrics
 */
function calculateNodeMetrics(
  nodes: Array<{
    online: boolean;
    lastSeen: { seconds: string; nanos: number };
    expiry: { seconds: string; nanos: number } | null;
  }>,
  now: Date
): NodeMetrics {
  let online = 0;
  let offline = 0;
  let expiringSoon = 0;
  let stale = 0;

  for (const node of nodes) {
    if (node.online) {
      online++;
    } else {
      offline++;
    }

    // Check expiry (null expiry means node never expires)
    if (node.expiry) {
      const expiryDate = parseTimestamp(node.expiry);
      const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysUntilExpiry > 0 && daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
        expiringSoon++;
      }
    }

    // Check for stale nodes (marked online but lastSeen > 24 hours ago)
    if (node.online) {
      const lastSeen = parseTimestamp(node.lastSeen);
      if (now.getTime() - lastSeen.getTime() > STALE_THRESHOLD_MS) {
        stale++;
      }
    }
  }

  return {
    total: nodes.length,
    online,
    offline,
    expiringSoon,
    stale,
  };
}

/**
 * Calculate route health metrics
 */
function calculateRouteMetrics(
  routes: Array<{
    enabled: boolean;
    prefix: string;
    node: { id: string };
  }>,
  offlineNodeIds: Set<string>
): RouteMetrics {
  let enabled = 0;
  let disabled = 0;
  let orphaned = 0;
  let exitTotal = 0;
  let exitEnabled = 0;

  for (const route of routes) {
    const isExitRoute = route.prefix === '0.0.0.0/0' || route.prefix === '::/0';

    if (route.enabled) {
      enabled++;
    } else {
      disabled++;
    }

    if (isExitRoute) {
      exitTotal++;
      if (route.enabled) {
        exitEnabled++;
      }
    }

    // Orphaned: enabled route on an offline node
    if (route.enabled && offlineNodeIds.has(route.node.id)) {
      orphaned++;
    }
  }

  return {
    total: routes.length,
    enabled,
    disabled,
    exitNodes: { total: exitTotal, enabled: exitEnabled },
    orphaned,
  };
}

/**
 * Calculate user metrics
 */
function calculateUserMetrics(
  users: Array<{ name: string }>,
  nodes: Array<{ user: { name: string } }>
): UserMetrics {
  const usersWithNodes = new Set(nodes.map((n) => n.user.name));

  return {
    total: users.length,
    withNodes: usersWithNodes.size,
  };
}

/**
 * Determine overall health status
 */
function determineOverallStatus(
  dbStatus: ServiceStatus,
  headscaleStatus: ServiceStatus,
  nodes: NodeMetrics,
  routes: RouteMetrics
): 'healthy' | 'degraded' | 'unhealthy' {
  // UNHEALTHY: Critical service failures
  if (dbStatus.status === 'error') return 'unhealthy';
  if (headscaleStatus.status === 'error') return 'unhealthy';

  // DEGRADED: Warnings present
  if (nodes.total > 0) {
    const onlinePercent = nodes.online / nodes.total;
    if (onlinePercent < 0.5) return 'degraded';
  }
  if (nodes.expiringSoon > 0) return 'degraded';
  if (nodes.stale > 0) return 'degraded';
  if (routes.orphaned > 0) return 'degraded';

  return 'healthy';
}

/**
 * GET /api/headscale/health
 *
 * Returns comprehensive network health status.
 * Requires authentication (USER role minimum = all authenticated users).
 */
export const GET = withMinimumRole('USER', async () => {
  const now = new Date();

  // Initialize status
  let dbStatus: ServiceStatus = { status: 'ok' };
  let headscaleStatus: ServiceStatus = { status: 'ok' };
  let nodeMetrics: NodeMetrics = {
    total: 0,
    online: 0,
    offline: 0,
    expiringSoon: 0,
    stale: 0,
  };
  let routeMetrics: RouteMetrics = {
    total: 0,
    enabled: 0,
    disabled: 0,
    exitNodes: { total: 0, enabled: 0 },
    orphaned: 0,
  };
  let userMetrics: UserMetrics = { total: 0, withNodes: 0 };

  // Check database connectivity with latency
  const dbStart = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = {
      status: 'ok',
      latencyMs: Math.round(performance.now() - dbStart),
    };
  } catch (error) {
    dbStatus = {
      status: 'error',
      latencyMs: Math.round(performance.now() - dbStart),
      message: error instanceof Error ? error.message : 'Database unreachable',
    };
  }

  // Check Headscale connectivity and fetch data
  const headscaleUrl = process.env.HEADSCALE_URL;
  const headscaleApiKey = process.env.HEADSCALE_API_KEY;

  if (headscaleUrl && headscaleApiKey) {
    const hsStart = performance.now();
    try {
      const client = getHeadscaleClient();

      // Fetch all data in parallel
      const [nodesResponse, routesResponse, usersResponse] = await Promise.all([
        client.listNodes(),
        client.listRoutes(),
        client.listUsers(),
      ]);

      headscaleStatus = {
        status: 'ok',
        latencyMs: Math.round(performance.now() - hsStart),
      };

      const nodes = nodesResponse.nodes || [];
      const routes = routesResponse.routes || [];
      const users = usersResponse.users || [];

      // Calculate metrics
      nodeMetrics = calculateNodeMetrics(nodes, now);

      // Get offline node IDs for route orphan calculation
      const offlineNodeIds = new Set(nodes.filter((n) => !n.online).map((n) => n.id));
      routeMetrics = calculateRouteMetrics(routes, offlineNodeIds);

      userMetrics = calculateUserMetrics(users, nodes);
    } catch (error) {
      headscaleStatus = {
        status: 'error',
        latencyMs: Math.round(performance.now() - hsStart),
        message:
          error instanceof HeadscaleClientError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Headscale unreachable',
      };
    }
  } else {
    headscaleStatus = {
      status: 'unconfigured',
      message: 'HEADSCALE_URL or HEADSCALE_API_KEY not set',
    };
  }

  // Determine overall status
  const overall = determineOverallStatus(dbStatus, headscaleStatus, nodeMetrics, routeMetrics);

  const response: NetworkHealth = {
    overall,
    lastUpdated: now.toISOString(),
    services: {
      database: dbStatus,
      headscale: headscaleStatus,
    },
    nodes: nodeMetrics,
    routes: routeMetrics,
    users: userMetrics,
  };

  // Return 503 for unhealthy, 200 otherwise
  const httpStatus = overall === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, { status: httpStatus });
});
