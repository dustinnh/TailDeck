/**
 * Route Query Hooks
 *
 * TanStack Query hooks for route operations with optimistic updates.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '../query-keys';

import type { Node } from './use-nodes';

/**
 * Route type from Headscale API
 */
export interface Route {
  id: string;
  node: Node;
  prefix: string;
  advertised: boolean;
  enabled: boolean;
  isPrimary: boolean;
}

/**
 * API client for route operations
 */
const api = {
  async listRoutes(): Promise<{ routes: Route[] }> {
    const res = await fetch('/api/headscale/routes');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch routes');
    }
    return res.json();
  },

  async enableRoute(id: string): Promise<{ route: Route }> {
    const res = await fetch(`/api/headscale/routes/${id}/enable`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to enable route');
    }
    return res.json();
  },

  async disableRoute(id: string): Promise<{ route: Route }> {
    const res = await fetch(`/api/headscale/routes/${id}/disable`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to disable route');
    }
    return res.json();
  },
};

/**
 * Fetch all routes
 */
export function useRoutes() {
  return useQuery({
    queryKey: queryKeys.routes.list(),
    queryFn: async () => {
      const data = await api.listRoutes();
      return data.routes;
    },
    // Refresh every 60 seconds
    refetchInterval: 60 * 1000,
  });
}

/**
 * Toggle route enabled/disabled with optimistic update
 */
export function useToggleRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? api.enableRoute(id) : api.disableRoute(id),

    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.routes.list() });

      const previousRoutes = queryClient.getQueryData<Route[]>(queryKeys.routes.list());

      if (previousRoutes) {
        queryClient.setQueryData<Route[]>(
          queryKeys.routes.list(),
          previousRoutes.map((route) => (route.id === id ? { ...route, enabled } : route))
        );
      }

      return { previousRoutes };
    },

    onError: (err, _vars, context) => {
      if (context?.previousRoutes) {
        queryClient.setQueryData(queryKeys.routes.list(), context.previousRoutes);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to toggle route');
    },

    onSuccess: (_, { enabled }) => {
      toast.success(enabled ? 'Route enabled' : 'Route disabled');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
    },
  });
}

/**
 * Helper to check if a route is an exit node route
 */
export function isExitNodeRoute(route: Route): boolean {
  return route.prefix === '0.0.0.0/0' || route.prefix === '::/0';
}

/**
 * Get routes grouped by node
 */
export function useRoutesByNode() {
  const { data: routes, ...rest } = useRoutes();

  const routesByNode = routes?.reduce(
    (acc, route) => {
      const nodeId = route.node.id;
      if (!acc[nodeId]) {
        acc[nodeId] = {
          node: route.node,
          routes: [],
        };
      }
      acc[nodeId].routes.push(route);
      return acc;
    },
    {} as Record<string, { node: Node; routes: Route[] }>
  );

  return {
    ...rest,
    data: routesByNode,
  };
}
