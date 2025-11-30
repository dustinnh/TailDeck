/**
 * Headscale Metrics Query Hook
 *
 * TanStack Query hook for fetching Headscale Prometheus metrics.
 */

'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../query-keys';

/**
 * System metrics from Headscale
 */
export interface SystemMetrics {
  goroutines: number;
  heapBytes: number;
  heapObjects: number;
  gcPauseSeconds: number;
  goVersion: string;
}

/**
 * HTTP metrics from Headscale
 */
export interface HttpMetrics {
  totalRequests: number;
  avgLatencyMs: number;
  requestsByPath: Array<{
    path: string;
    count: number;
    avgLatencyMs: number;
  }>;
}

/**
 * Complete Headscale metrics response
 */
export interface HeadscaleMetrics {
  timestamp: string;
  system: SystemMetrics;
  http: HttpMetrics;
  available: boolean;
  error?: string;
}

/**
 * Fetch metrics from API
 */
async function fetchMetrics(): Promise<HeadscaleMetrics> {
  const res = await fetch('/api/headscale/metrics');
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch metrics');
  }
  return res.json();
}

/**
 * Hook to fetch Headscale metrics
 *
 * Auto-refreshes every 15 seconds for near real-time monitoring.
 */
export function useHeadscaleMetrics() {
  return useQuery({
    queryKey: [...queryKeys.health.all, 'metrics'] as const,
    queryFn: fetchMetrics,
    refetchInterval: 15 * 1000, // Refresh every 15 seconds
    staleTime: 10 * 1000, // Consider fresh for 10 seconds
  });
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format milliseconds to human readable string
 */
export function formatLatency(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
