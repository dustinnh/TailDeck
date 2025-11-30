/**
 * Network Health Query Hook
 *
 * TanStack Query hook for fetching network health status.
 */

'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../query-keys';

/**
 * Service status for individual services
 */
export interface ServiceStatus {
  status: 'ok' | 'error' | 'unconfigured';
  latencyMs?: number;
  message?: string;
}

/**
 * Node health metrics
 */
export interface NodeMetrics {
  total: number;
  online: number;
  offline: number;
  expiringSoon: number;
  stale: number;
}

/**
 * Route health metrics
 */
export interface RouteMetrics {
  total: number;
  enabled: number;
  disabled: number;
  exitNodes: {
    total: number;
    enabled: number;
  };
  orphaned: number;
}

/**
 * User metrics
 */
export interface UserMetrics {
  total: number;
  withNodes: number;
}

/**
 * Complete network health response
 */
export interface NetworkHealth {
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
 * Fetch network health from API
 */
async function fetchNetworkHealth(): Promise<NetworkHealth> {
  const res = await fetch('/api/headscale/health');
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch health status');
  }
  return res.json();
}

/**
 * Hook to fetch network health status
 *
 * Auto-refreshes every 30 seconds for near real-time monitoring.
 */
export function useNetworkHealth() {
  return useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: fetchNetworkHealth,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    staleTime: 15 * 1000, // Consider fresh for 15 seconds
  });
}
