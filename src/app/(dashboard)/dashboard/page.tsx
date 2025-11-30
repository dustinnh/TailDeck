/**
 * Dashboard Page
 *
 * Overview page showing:
 * - Headscale health status
 * - Quick stats (total nodes, online, exit nodes, routes)
 * - Quick actions (role-based)
 * - Recent audit activity
 */

import { formatDistanceToNow } from 'date-fns';
import { Suspense } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/auth';
import { getHeadscaleClient } from '@/server/headscale';
import { getRecentAuditLogs } from '@/server/services/audit';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Headscale network</p>
      </div>

      {/* Health and Stats */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards />
      </Suspense>

      {/* Quick Actions - Only for operators and above */}
      {session?.user.roles?.some((r) => ['OPERATOR', 'ADMIN', 'OWNER'].includes(r)) && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <a
                href="/machines"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Manage Machines
              </a>
              <a
                href="/routes"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                View Routes
              </a>
              <a
                href="/devices/add"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Add Device
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity - For auditors and above */}
      {session?.user.roles?.some((r) => ['AUDITOR', 'OPERATOR', 'ADMIN', 'OWNER'].includes(r)) && (
        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentActivity />
        </Suspense>
      )}
    </div>
  );
}

async function StatsCards() {
  let nodes: { online: number; total: number; exitNodes: number } = {
    online: 0,
    total: 0,
    exitNodes: 0,
  };
  let routes = { total: 0, enabled: 0 };
  let isHealthy = false;
  let error: string | null = null;

  try {
    const client = getHeadscaleClient();

    // Fetch nodes
    const nodesResponse = await client.listNodes();
    nodes = {
      total: nodesResponse.nodes.length,
      online: nodesResponse.nodes.filter((n) => n.online).length,
      exitNodes: 0, // Will be calculated from routes
    };

    // Fetch routes
    const routesResponse = await client.listRoutes();
    routes = {
      total: routesResponse.routes.length,
      enabled: routesResponse.routes.filter((r) => r.enabled).length,
    };

    // Count exit nodes (nodes with exit routes)
    const exitNodeIds = new Set(
      routesResponse.routes
        .filter((r) => r.prefix === '0.0.0.0/0' || r.prefix === '::/0')
        .map((r) => r.node.id)
    );
    nodes.exitNodes = exitNodeIds.size;

    isHealthy = true;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to connect to Headscale';
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Health Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Headscale Status</CardTitle>
          <Badge variant={isHealthy ? 'default' : 'destructive'}>
            {isHealthy ? 'Healthy' : 'Error'}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isHealthy ? 'Connected' : 'Disconnected'}</div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Total Nodes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{nodes.total}</div>
          <p className="text-xs text-muted-foreground">{nodes.online} online</p>
        </CardContent>
      </Card>

      {/* Exit Nodes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Exit Nodes</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{nodes.exitNodes}</div>
          <p className="text-xs text-muted-foreground">Configured as exit</p>
        </CardContent>
      </Card>

      {/* Routes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Routes</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{routes.total}</div>
          <p className="text-xs text-muted-foreground">{routes.enabled} enabled</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-1 h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function RecentActivity() {
  const logs = await getRecentAuditLogs(5);

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest actions in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{formatAction(log.action)}</p>
                <p className="text-xs text-muted-foreground">
                  {log.user?.name || log.actorEmail || 'System'} • {log.resourceType}
                  {log.resourceId && `: ${log.resourceId}`}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(log.timestamp, { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <a href="/audit" className="text-sm text-primary hover:underline">
            View all activity →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest actions in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    CREATE_NODE: 'Created machine',
    DELETE_NODE: 'Deleted machine',
    RENAME_NODE: 'Renamed machine',
    UPDATE_TAGS: 'Updated tags',
    EXPIRE_NODE: 'Expired machine',
    ENABLE_ROUTE: 'Enabled route',
    DISABLE_ROUTE: 'Disabled route',
    UPDATE_ACL: 'Updated ACL policy',
    CREATE_KEY: 'Created auth key',
    EXPIRE_KEY: 'Expired auth key',
    ASSIGN_ROLE: 'Assigned role',
    REMOVE_ROLE: 'Removed role',
    USER_LOGIN: 'User logged in',
    USER_LOGOUT: 'User logged out',
  };
  return actionMap[action] || action;
}
