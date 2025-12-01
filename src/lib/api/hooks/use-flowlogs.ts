/**
 * Flow Logs Query Hooks
 *
 * TanStack Query hooks for fetching and querying flow logs from Loki.
 */

'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../query-keys';

/**
 * Flow record from the API
 */
export interface FlowRecord {
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  sourcePort?: number;
  destinationPort?: number;
  protocol: string;
  bytes?: number;
  packets?: number;
  action: 'accept' | 'drop';
  sourceNode?: string;
  destinationNode?: string;
  sourceUser?: string;
  destinationUser?: string;
  raw?: string;
  labels?: Record<string, string>;
}

/**
 * Flow query response from the API
 */
export interface FlowQueryResponse {
  records: FlowRecord[];
  hasMore: boolean;
  stats?: {
    executionTimeMs: number;
  };
}

/**
 * Flow labels response from the API
 */
export interface FlowLabelsResponse {
  labels: string[];
}

/**
 * Flow log health status
 */
export interface FlowLogHealthStatus {
  enabled: boolean;
  healthy: boolean;
  provider: string;
  message: string;
  error?: {
    code?: string;
    statusCode?: number;
  };
}

/**
 * Query parameters for flow logs
 */
export interface FlowQueryParams {
  query: string;
  start?: string | Date;
  end?: string | Date;
  limit?: number;
  direction?: 'forward' | 'backward';
}

/**
 * Fetch flow logs from API
 */
async function fetchFlowLogs(params: FlowQueryParams): Promise<FlowQueryResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('query', params.query);

  if (params.start) {
    const startDate = params.start instanceof Date ? params.start.toISOString() : params.start;
    searchParams.set('start', startDate);
  }

  if (params.end) {
    const endDate = params.end instanceof Date ? params.end.toISOString() : params.end;
    searchParams.set('end', endDate);
  }

  if (params.limit) {
    searchParams.set('limit', params.limit.toString());
  }

  if (params.direction) {
    searchParams.set('direction', params.direction);
  }

  const res = await fetch(`/api/flowlogs?${searchParams.toString()}`);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch flow logs');
  }

  return res.json();
}

/**
 * Fetch available labels from API
 */
async function fetchLabels(timeRange?: {
  start?: string;
  end?: string;
}): Promise<FlowLabelsResponse> {
  const searchParams = new URLSearchParams();

  if (timeRange?.start) {
    searchParams.set('start', timeRange.start);
  }

  if (timeRange?.end) {
    searchParams.set('end', timeRange.end);
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/api/flowlogs/labels?${queryString}` : '/api/flowlogs/labels';

  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch labels');
  }

  return res.json();
}

/**
 * Fetch label values from API
 */
async function fetchLabelValues(
  labelName: string,
  timeRange?: { start?: string; end?: string }
): Promise<FlowLabelsResponse> {
  const searchParams = new URLSearchParams();

  if (timeRange?.start) {
    searchParams.set('start', timeRange.start);
  }

  if (timeRange?.end) {
    searchParams.set('end', timeRange.end);
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `/api/flowlogs/labels/${encodeURIComponent(labelName)}?${queryString}`
    : `/api/flowlogs/labels/${encodeURIComponent(labelName)}`;

  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch label values');
  }

  return res.json();
}

/**
 * Fetch flow log health status from API
 */
async function fetchFlowLogHealth(): Promise<FlowLogHealthStatus> {
  const res = await fetch('/api/flowlogs/health');

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch flow log health');
  }

  return res.json();
}

/**
 * Hook to query flow logs
 *
 * @param params - Query parameters including LogQL query, time range, limit, direction
 * @param options - Additional query options (enabled, refetchInterval, etc.)
 */
export function useFlowLogs(
  params: FlowQueryParams,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  const normalizedParams = {
    query: params.query,
    start: params.start instanceof Date ? params.start.toISOString() : params.start,
    end: params.end instanceof Date ? params.end.toISOString() : params.end,
    limit: params.limit,
    direction: params.direction,
  };

  return useQuery({
    queryKey: queryKeys.flowLogs.query(normalizedParams),
    queryFn: () => fetchFlowLogs(params),
    enabled: options?.enabled !== false && !!params.query,
    refetchInterval: options?.refetchInterval,
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
  });
}

/**
 * Hook to fetch available flow log labels
 *
 * @param timeRange - Optional time range to scope labels
 */
export function useFlowLogLabels(timeRange?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: queryKeys.flowLogs.labels(timeRange),
    queryFn: () => fetchLabels(timeRange),
    staleTime: 5 * 60 * 1000, // Labels don't change often, cache for 5 minutes
  });
}

/**
 * Hook to fetch values for a specific label
 *
 * @param labelName - The label name to get values for
 * @param timeRange - Optional time range to scope values
 */
export function useFlowLogLabelValues(
  labelName: string,
  timeRange?: { start?: string; end?: string }
) {
  return useQuery({
    queryKey: queryKeys.flowLogs.labelValues(labelName, timeRange),
    queryFn: () => fetchLabelValues(labelName, timeRange),
    enabled: !!labelName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to fetch flow log health status
 *
 * Auto-refreshes every 60 seconds.
 */
export function useFlowLogHealth() {
  return useQuery({
    queryKey: queryKeys.flowLogs.health(),
    queryFn: fetchFlowLogHealth,
    refetchInterval: 60 * 1000, // Refresh every minute
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
  });
}
