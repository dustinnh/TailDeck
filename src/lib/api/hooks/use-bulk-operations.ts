/**
 * Bulk Node Operations Hook
 *
 * TanStack Query hook for performing bulk operations on multiple nodes.
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../query-keys';

import type { Node } from './use-nodes';

/**
 * Bulk action types
 */
export type BulkAction = 'delete' | 'expire' | 'move' | 'tags';

/**
 * Bulk operation request
 */
export interface BulkOperationRequest {
  action: BulkAction;
  nodeIds: string[];
  newUser?: string;
  tags?: string[];
}

/**
 * Individual operation result
 */
export interface BulkOperationResult {
  nodeId: string;
  success: boolean;
  error?: string;
}

/**
 * Bulk operation response
 */
export interface BulkOperationResponse {
  results: BulkOperationResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * API client for bulk operations
 */
const api = {
  async bulkOperation(request: BulkOperationRequest): Promise<BulkOperationResponse> {
    const res = await fetch('/api/headscale/nodes/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to perform bulk operation');
    }
    return res.json();
  },
};

/**
 * Perform bulk operations on multiple nodes
 */
export function useBulkOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: BulkOperationRequest) => api.bulkOperation(request),

    onMutate: async (request) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes.list() });

      // Snapshot previous value
      const previousNodes = queryClient.getQueryData<Node[]>(queryKeys.nodes.list());

      // Optimistically update based on action
      if (previousNodes) {
        let updatedNodes = [...previousNodes];

        switch (request.action) {
          case 'delete':
            updatedNodes = updatedNodes.filter((node) => !request.nodeIds.includes(node.id));
            break;
          case 'expire':
            // Mark nodes as expired (set expiry to past)
            updatedNodes = updatedNodes.map((node) =>
              request.nodeIds.includes(node.id)
                ? { ...node, expiry: { seconds: '0', nanos: 0 } }
                : node
            );
            break;
          case 'move':
            // Update user for moved nodes
            if (request.newUser) {
              updatedNodes = updatedNodes.map((node) =>
                request.nodeIds.includes(node.id)
                  ? {
                      ...node,
                      user: { ...node.user, name: request.newUser! },
                    }
                  : node
              );
            }
            break;
          case 'tags':
            // Update tags for nodes
            if (request.tags) {
              updatedNodes = updatedNodes.map((node) =>
                request.nodeIds.includes(node.id) ? { ...node, forcedTags: request.tags! } : node
              );
            }
            break;
        }

        queryClient.setQueryData<Node[]>(queryKeys.nodes.list(), updatedNodes);
      }

      return { previousNodes };
    },

    onError: (_err, _request, context) => {
      // Rollback on error
      if (context?.previousNodes) {
        queryClient.setQueryData(queryKeys.nodes.list(), context.previousNodes);
      }
    },

    onSettled: () => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routes.all });
    },
  });
}

/**
 * Helper hooks for specific bulk operations
 */
export function useBulkDeleteNodes() {
  const bulkOperation = useBulkOperation();

  return {
    ...bulkOperation,
    mutate: (nodeIds: string[]) => bulkOperation.mutate({ action: 'delete', nodeIds }),
    mutateAsync: (nodeIds: string[]) => bulkOperation.mutateAsync({ action: 'delete', nodeIds }),
  };
}

export function useBulkExpireNodes() {
  const bulkOperation = useBulkOperation();

  return {
    ...bulkOperation,
    mutate: (nodeIds: string[]) => bulkOperation.mutate({ action: 'expire', nodeIds }),
    mutateAsync: (nodeIds: string[]) => bulkOperation.mutateAsync({ action: 'expire', nodeIds }),
  };
}

export function useBulkMoveNodes() {
  const bulkOperation = useBulkOperation();

  return {
    ...bulkOperation,
    mutate: ({ nodeIds, newUser }: { nodeIds: string[]; newUser: string }) =>
      bulkOperation.mutate({ action: 'move', nodeIds, newUser }),
    mutateAsync: ({ nodeIds, newUser }: { nodeIds: string[]; newUser: string }) =>
      bulkOperation.mutateAsync({ action: 'move', nodeIds, newUser }),
  };
}

export function useBulkUpdateTags() {
  const bulkOperation = useBulkOperation();

  return {
    ...bulkOperation,
    mutate: ({ nodeIds, tags }: { nodeIds: string[]; tags: string[] }) =>
      bulkOperation.mutate({ action: 'tags', nodeIds, tags }),
    mutateAsync: ({ nodeIds, tags }: { nodeIds: string[]; tags: string[] }) =>
      bulkOperation.mutateAsync({ action: 'tags', nodeIds, tags }),
  };
}
