'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';

import {
  FlowLogQueryBuilder,
  FlowLogTable,
  FlowLogSkeleton,
  type FlowLogQueryParams,
} from '@/components/flowlogs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFlowLogs, useFlowLogHealth } from '@/lib/api/hooks/use-flowlogs';

export function FlowLogsClient() {
  const [queryParams, setQueryParams] = useState<FlowLogQueryParams | null>(null);

  // Check flow log health/configuration status
  const { data: healthData, isLoading: isHealthLoading } = useFlowLogHealth();

  // Query flow logs when params are set
  const {
    data: flowData,
    isLoading: isFlowLoading,
    error: flowError,
    refetch,
  } = useFlowLogs(
    {
      query: queryParams?.query ?? '{job="tailscale"}',
      start: queryParams?.timeRange.start,
      end: queryParams?.timeRange.end,
      limit: queryParams?.limit ?? 100,
    },
    {
      enabled: !!queryParams && healthData?.enabled === true,
    }
  );

  const handleQuery = useCallback((params: FlowLogQueryParams) => {
    setQueryParams(params);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Show loading state while checking health
  if (isHealthLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show configuration message if not enabled
  if (!healthData?.enabled) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Flow Logging Not Configured</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Flow logging requires a Loki backend to be configured. To enable flow logs:
          </p>
          <ol className="list-inside list-decimal space-y-1 text-sm">
            <li>
              Set the <code className="rounded bg-muted px-1">LOKI_URL</code> environment variable
            </li>
            <li>
              Optionally configure <code className="rounded bg-muted px-1">LOKI_TENANT_ID</code>,{' '}
              <code className="rounded bg-muted px-1">LOKI_USERNAME</code>, and{' '}
              <code className="rounded bg-muted px-1">LOKI_PASSWORD</code>
            </li>
            <li>Restart the TailDeck application</li>
          </ol>
        </AlertDescription>
      </Alert>
    );
  }

  // Show unhealthy status
  if (healthData.enabled && !healthData.healthy) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Flow Log Backend Unhealthy</AlertTitle>
        <AlertDescription>
          <p>Unable to connect to the flow log backend ({healthData.provider}).</p>
          {healthData.message && <p className="mt-1 text-sm">{healthData.message}</p>}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Query Builder */}
      <FlowLogQueryBuilder
        onQuery={handleQuery}
        isLoading={isFlowLoading}
        onRefresh={handleRefresh}
      />

      {/* Error State */}
      {flowError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {flowError instanceof Error ? flowError.message : 'Failed to fetch flow logs'}
          </AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {isFlowLoading ? (
        <FlowLogSkeleton rows={10} />
      ) : flowData ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {flowData.records.length} records
              {flowData.hasMore && ' (more available)'}
            </span>
            {flowData.stats?.executionTimeMs && (
              <span>Query took {flowData.stats.executionTimeMs}ms</span>
            )}
          </div>
          <FlowLogTable records={flowData.records} isLoading={isFlowLoading} />
        </div>
      ) : null}
    </div>
  );
}
