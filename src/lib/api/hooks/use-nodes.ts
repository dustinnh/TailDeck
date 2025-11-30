/**
 * Node/Machine Query Hooks
 *
 * TanStack Query hooks for node operations with optimistic updates.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '../query-keys';

/**
 * Node type from Headscale API
 */
export interface Node {
  id: string;
  machineKey: string;
  nodeKey: string;
  ipAddresses: string[];
  name: string;
  user: {
    id: string;
    name: string;
    createdAt: { seconds: string; nanos: number };
  };
  lastSeen: { seconds: string; nanos: number };
  expiry: { seconds: string; nanos: number };
  forcedTags: string[];
  validTags: string[];
  givenName: string;
  online: boolean;
  registerMethod: string;
}

/**
 * API client for node operations
 */
const api = {
  async listNodes(): Promise<{ nodes: Node[] }> {
    const res = await fetch('/api/headscale/nodes');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch nodes');
    }
    return res.json();
  },

  async getNode(id: string): Promise<{ node: Node }> {
    const res = await fetch(`/api/headscale/nodes/${id}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch node');
    }
    return res.json();
  },

  async renameNode(id: string, newName: string): Promise<{ node: Node }> {
    const res = await fetch(`/api/headscale/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ givenName: newName }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to rename node');
    }
    return res.json();
  },

  async updateTags(id: string, tags: string[]): Promise<{ node: Node }> {
    const res = await fetch(`/api/headscale/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update tags');
    }
    return res.json();
  },

  async expireNode(id: string): Promise<{ node: Node }> {
    const res = await fetch(`/api/headscale/nodes/${id}/expire`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to expire node');
    }
    return res.json();
  },

  async deleteNode(id: string): Promise<void> {
    const res = await fetch(`/api/headscale/nodes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete node');
    }
  },

  async moveNode(id: string, user: string): Promise<{ node: Node }> {
    const res = await fetch(`/api/headscale/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to move node');
    }
    return res.json();
  },

  async setExpiry(id: string, expiry: string): Promise<{ node: Node }> {
    const res = await fetch(`/api/headscale/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiry }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to set node expiry');
    }
    return res.json();
  },
};

/**
 * Fetch all nodes
 */
export function useNodes() {
  return useQuery({
    queryKey: queryKeys.nodes.list(),
    queryFn: async () => {
      const data = await api.listNodes();
      return data.nodes;
    },
    // Refresh every 60 seconds for real-time status
    refetchInterval: 60 * 1000,
  });
}

/**
 * Fetch a single node by ID
 */
export function useNode(id: string) {
  return useQuery({
    queryKey: queryKeys.nodes.detail(id),
    queryFn: async () => {
      const data = await api.getNode(id);
      return data.node;
    },
    enabled: !!id,
  });
}

/**
 * Rename a node with optimistic update
 */
export function useRenameNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) => api.renameNode(id, newName),

    onMutate: async ({ id, newName }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes.list() });
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes.detail(id) });

      // Snapshot previous values
      const previousNodes = queryClient.getQueryData<Node[]>(queryKeys.nodes.list());
      const previousNode = queryClient.getQueryData<Node>(queryKeys.nodes.detail(id));

      // Optimistically update the cache
      if (previousNodes) {
        queryClient.setQueryData<Node[]>(
          queryKeys.nodes.list(),
          previousNodes.map((node) => (node.id === id ? { ...node, givenName: newName } : node))
        );
      }
      if (previousNode) {
        queryClient.setQueryData<Node>(queryKeys.nodes.detail(id), {
          ...previousNode,
          givenName: newName,
        });
      }

      return { previousNodes, previousNode };
    },

    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousNodes) {
        queryClient.setQueryData(queryKeys.nodes.list(), context.previousNodes);
      }
      if (context?.previousNode) {
        queryClient.setQueryData(queryKeys.nodes.detail(id), context.previousNode);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to rename node');
    },

    onSuccess: () => {
      toast.success('Node renamed successfully');
    },

    onSettled: (_data, _err, { id }) => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.detail(id) });
    },
  });
}

/**
 * Update node tags with optimistic update
 */
export function useUpdateNodeTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => api.updateTags(id, tags),

    onMutate: async ({ id, tags }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes.list() });

      const previousNodes = queryClient.getQueryData<Node[]>(queryKeys.nodes.list());

      if (previousNodes) {
        queryClient.setQueryData<Node[]>(
          queryKeys.nodes.list(),
          previousNodes.map((node) => (node.id === id ? { ...node, forcedTags: tags } : node))
        );
      }

      return { previousNodes };
    },

    onError: (err, _vars, context) => {
      if (context?.previousNodes) {
        queryClient.setQueryData(queryKeys.nodes.list(), context.previousNodes);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to update tags');
    },

    onSuccess: () => {
      toast.success('Tags updated successfully');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.list() });
    },
  });
}

/**
 * Expire a node
 */
export function useExpireNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.expireNode(id),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to expire node');
    },
    onSuccess: () => {
      toast.success('Node expired successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.all });
    },
  });
}

/**
 * Delete a node
 */
export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteNode(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes.list() });

      const previousNodes = queryClient.getQueryData<Node[]>(queryKeys.nodes.list());

      if (previousNodes) {
        queryClient.setQueryData<Node[]>(
          queryKeys.nodes.list(),
          previousNodes.filter((node) => node.id !== id)
        );
      }

      return { previousNodes };
    },

    onError: (err, _id, context) => {
      if (context?.previousNodes) {
        queryClient.setQueryData(queryKeys.nodes.list(), context.previousNodes);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to delete node');
    },

    onSuccess: () => {
      toast.success('Node deleted successfully');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.all });
    },
  });
}

/**
 * Move a node to a different user
 */
export function useMoveNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, user }: { id: string; user: string }) => api.moveNode(id, user),

    onMutate: async ({ id, user }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes.list() });

      const previousNodes = queryClient.getQueryData<Node[]>(queryKeys.nodes.list());

      if (previousNodes) {
        queryClient.setQueryData<Node[]>(
          queryKeys.nodes.list(),
          previousNodes.map((node) =>
            node.id === id ? { ...node, user: { ...node.user, name: user } } : node
          )
        );
      }

      return { previousNodes };
    },

    onError: (err, _vars, context) => {
      if (context?.previousNodes) {
        queryClient.setQueryData(queryKeys.nodes.list(), context.previousNodes);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to move node');
    },

    onSuccess: () => {
      toast.success('Node moved successfully');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.all });
    },
  });
}

/**
 * Set node expiry (renew or set custom expiry)
 */
export function useSetNodeExpiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, expiry }: { id: string; expiry: string }) => api.setExpiry(id, expiry),

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to set expiry');
    },

    onSuccess: () => {
      toast.success('Expiry updated successfully');
    },

    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes.detail(id) });
    },
  });
}
