'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  RefreshCw,
  Route,
  Server,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';

import { HttpLatencyChart, MetricsStatsCard } from '@/components/charts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNetworkHealth,
  type NetworkHealth,
  type ServiceStatus,
} from '@/lib/api/hooks/use-health';
import {
  formatBytes,
  formatLatency,
  useHeadscaleMetrics,
  type HeadscaleMetrics,
} from '@/lib/api/hooks/use-metrics';

/**
 * Get badge variant based on overall status
 */
function getStatusVariant(
  status: NetworkHealth['overall']
): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'healthy':
      return 'default';
    case 'degraded':
      return 'secondary';
    case 'unhealthy':
      return 'destructive';
  }
}

/**
 * Get status icon based on service status
 */
function StatusIcon({ status }: { status: ServiceStatus['status'] }) {
  switch (status) {
    case 'ok':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'unconfigured':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Overall Status Banner
 */
function OverallStatusBanner({
  health,
  dataUpdatedAt,
  refetch,
  isRefetching,
}: {
  health: NetworkHealth;
  dataUpdatedAt: number;
  refetch: () => void;
  isRefetching: boolean;
}) {
  const statusText = {
    healthy: 'All Systems Operational',
    degraded: 'Some Issues Detected',
    unhealthy: 'Critical Issues',
  };

  const StatusIconComponent = {
    healthy: CheckCircle,
    degraded: AlertTriangle,
    unhealthy: XCircle,
  }[health.overall];

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4">
          <StatusIconComponent
            className={`h-8 w-8 ${
              health.overall === 'healthy'
                ? 'text-green-500'
                : health.overall === 'degraded'
                  ? 'text-yellow-500'
                  : 'text-destructive'
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{statusText[health.overall]}</h2>
              <Badge variant={getStatusVariant(health.overall)}>
                {health.overall.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Last updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Services Status Card
 */
function ServicesCard({ services }: { services: NetworkHealth['services'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5" />
          Services
        </CardTitle>
        <CardDescription>Core service connectivity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span>Database</span>
          </div>
          <div className="flex items-center gap-2">
            {services.database.latencyMs !== undefined && (
              <span className="text-xs text-muted-foreground">{services.database.latencyMs}ms</span>
            )}
            <StatusIcon status={services.database.status} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span>Headscale</span>
          </div>
          <div className="flex items-center gap-2">
            {services.headscale.latencyMs !== undefined && (
              <span className="text-xs text-muted-foreground">
                {services.headscale.latencyMs}ms
              </span>
            )}
            <StatusIcon status={services.headscale.status} />
          </div>
        </div>
        {services.headscale.message && services.headscale.status !== 'ok' && (
          <p className="text-xs text-muted-foreground">{services.headscale.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Nodes Status Card
 */
function NodesCard({ nodes }: { nodes: NetworkHealth['nodes'] }) {
  const onlinePercent = nodes.total > 0 ? Math.round((nodes.online / nodes.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5" />
          Nodes
        </CardTitle>
        <CardDescription>Machine connectivity status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">{nodes.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Online</span>
          <span className="font-medium text-green-600">
            {nodes.online} ({onlinePercent}%)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Offline</span>
          <span className={nodes.offline > 0 ? 'font-medium text-muted-foreground' : 'font-medium'}>
            {nodes.offline}
          </span>
        </div>
        {nodes.expiringSoon > 0 && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              Expiring soon
            </span>
            <span className="font-medium text-yellow-600">{nodes.expiringSoon}</span>
          </div>
        )}
        {nodes.stale > 0 && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              Stale
            </span>
            <span className="font-medium text-yellow-600">{nodes.stale}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Routes Status Card
 */
function RoutesCard({ routes }: { routes: NetworkHealth['routes'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Route className="h-5 w-5" />
          Routes
        </CardTitle>
        <CardDescription>Network routing status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subnet Routes</span>
          <span className="font-medium">{routes.total - routes.exitNodes.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Enabled</span>
          <span className="font-medium text-green-600">
            {routes.enabled - routes.exitNodes.enabled}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Exit Nodes</span>
          <span className="font-medium">{routes.exitNodes.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Exit Enabled</span>
          <span className="font-medium text-green-600">{routes.exitNodes.enabled}</span>
        </div>
        {routes.orphaned > 0 && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              Orphaned
            </span>
            <span className="font-medium text-yellow-600">{routes.orphaned}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Users Status Card
 */
function UsersCard({ users }: { users: NetworkHealth['users'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Users
        </CardTitle>
        <CardDescription>Headscale namespaces</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">{users.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">With Nodes</span>
          <span className="font-medium">{users.withNodes}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Metrics Section - Shows Headscale system and HTTP metrics
 */
function MetricsSection({
  metrics,
  isLoading,
}: {
  metrics: HeadscaleMetrics | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold">Headscale Metrics</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!metrics?.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Headscale Metrics
          </CardTitle>
          <CardDescription>System and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Metrics Not Available</AlertTitle>
            <AlertDescription>
              {metrics?.error || 'Configure HEADSCALE_METRICS_URL to enable metrics monitoring.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Headscale Metrics</h3>

      {/* System Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsStatsCard
          title="Goroutines"
          value={metrics.system.goroutines.toLocaleString()}
          description="Active Go routines"
          icon={Cpu}
        />
        <MetricsStatsCard
          title="Heap Memory"
          value={formatBytes(metrics.system.heapBytes)}
          description={`${metrics.system.heapObjects.toLocaleString()} objects`}
          icon={HardDrive}
        />
        <MetricsStatsCard
          title="HTTP Requests"
          value={metrics.http.totalRequests.toLocaleString()}
          description="Total requests served"
          icon={Zap}
        />
        <MetricsStatsCard
          title="Avg Latency"
          value={formatLatency(metrics.http.avgLatencyMs)}
          description="Average response time"
          icon={Gauge}
        />
      </div>

      {/* HTTP Latency Chart */}
      {metrics.http.requestsByPath.length > 0 && (
        <HttpLatencyChart data={metrics.http.requestsByPath} />
      )}

      {/* Go Version Badge */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Server className="h-4 w-4" />
        <span>Go Version: {metrics.system.goVersion}</span>
        <span className="mx-2">|</span>
        <span>GC Pause: {(metrics.system.gcPauseSeconds * 1000).toFixed(2)}ms</span>
      </div>
    </div>
  );
}

/**
 * Issues Card - Shows actionable warnings
 */
function IssuesCard({ health }: { health: NetworkHealth }) {
  const issues: Array<{
    icon: typeof AlertTriangle;
    message: string;
    severity: 'warning' | 'error';
  }> = [];

  // Check for service issues
  if (health.services.database.status === 'error') {
    issues.push({
      icon: XCircle,
      message: 'Database is unreachable',
      severity: 'error',
    });
  }
  if (health.services.headscale.status === 'error') {
    issues.push({
      icon: XCircle,
      message: 'Headscale API is unreachable',
      severity: 'error',
    });
  }

  // Check for node issues
  if (health.nodes.expiringSoon > 0) {
    issues.push({
      icon: AlertTriangle,
      message: `${health.nodes.expiringSoon} node${health.nodes.expiringSoon > 1 ? 's' : ''} expiring within 7 days`,
      severity: 'warning',
    });
  }
  if (health.nodes.stale > 0) {
    issues.push({
      icon: AlertTriangle,
      message: `${health.nodes.stale} stale node${health.nodes.stale > 1 ? 's' : ''} (online but not seen in 24h)`,
      severity: 'warning',
    });
  }
  if (health.nodes.total > 0 && health.nodes.online / health.nodes.total < 0.5) {
    issues.push({
      icon: AlertTriangle,
      message: 'More than 50% of nodes are offline',
      severity: 'warning',
    });
  }

  // Check for route issues
  if (health.routes.orphaned > 0) {
    issues.push({
      icon: AlertTriangle,
      message: `${health.routes.orphaned} route${health.routes.orphaned > 1 ? 's' : ''} on offline node${health.routes.orphaned > 1 ? 's' : ''}`,
      severity: 'warning',
    });
  }

  if (issues.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>No Issues Detected</AlertTitle>
        <AlertDescription>All systems are operating normally.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Issues</h3>
      {issues.map((issue, index) => (
        <Alert key={index} variant={issue.severity === 'error' ? 'destructive' : 'default'}>
          <issue.icon className="h-4 w-4" />
          <AlertDescription>{issue.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

/**
 * Loading skeleton for health page
 */
function HealthClientSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

/**
 * Error state for health page
 */
function HealthErrorCard({ error, refetch }: { error: Error; refetch: () => void }) {
  return (
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertTitle>Failed to load health status</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{error.message}</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Main Health Client Component
 */
export function HealthClient() {
  const {
    data: health,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
    isRefetching,
  } = useNetworkHealth();
  const { data: metrics, isLoading: metricsLoading } = useHeadscaleMetrics();

  if (isLoading) {
    return <HealthClientSkeleton />;
  }

  if (error) {
    return <HealthErrorCard error={error as Error} refetch={refetch} />;
  }

  if (!health) {
    return null;
  }

  return (
    <div className="space-y-6">
      <OverallStatusBanner
        health={health}
        dataUpdatedAt={dataUpdatedAt}
        refetch={refetch}
        isRefetching={isRefetching}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ServicesCard services={health.services} />
        <NodesCard nodes={health.nodes} />
        <RoutesCard routes={health.routes} />
        <UsersCard users={health.users} />
      </div>

      <IssuesCard health={health} />

      <MetricsSection metrics={metrics} isLoading={metricsLoading} />
    </div>
  );
}
