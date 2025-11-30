/**
 * API Keys Query Hooks
 *
 * TanStack Query hooks for Headscale API key operations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../query-keys';

/**
 * Timestamp type
 */
interface Timestamp {
  seconds: string;
  nanos: number;
}

/**
 * API Key type from Headscale
 */
export interface ApiKey {
  id: string;
  prefix: string;
  expiration: Timestamp;
  createdAt: Timestamp;
  lastSeen?: Timestamp;
}

/**
 * API client for API key operations
 */
const api = {
  async listApiKeys(): Promise<{ apiKeys: ApiKey[] }> {
    const res = await fetch('/api/headscale/apikeys');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch API keys');
    }
    return res.json();
  },

  async createApiKey(expiration?: string): Promise<{ apiKey: string }> {
    const res = await fetch('/api/headscale/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expiration ? { expiration } : {}),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create API key');
    }
    return res.json();
  },

  async expireApiKey(prefix: string): Promise<void> {
    const res = await fetch(`/api/headscale/apikeys/${encodeURIComponent(prefix)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to expire API key');
    }
  },

  async deleteApiKey(prefix: string): Promise<void> {
    const res = await fetch(`/api/headscale/apikeys/${encodeURIComponent(prefix)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete API key');
    }
  },
};

/**
 * Fetch all API keys
 */
export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.apiKeys.list(),
    queryFn: async () => {
      const data = await api.listApiKeys();
      return data.apiKeys;
    },
  });
}

/**
 * Create a new API key
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expiration?: string) => api.createApiKey(expiration),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
}

/**
 * Expire an API key
 */
export function useExpireApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefix: string) => api.expireApiKey(prefix),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
}

/**
 * Delete an API key with optimistic update
 */
export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefix: string) => api.deleteApiKey(prefix),

    onMutate: async (prefix) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.apiKeys.list() });

      const previousKeys = queryClient.getQueryData<ApiKey[]>(queryKeys.apiKeys.list());

      if (previousKeys) {
        queryClient.setQueryData<ApiKey[]>(
          queryKeys.apiKeys.list(),
          previousKeys.filter((key) => key.prefix !== prefix)
        );
      }

      return { previousKeys };
    },

    onError: (_err, _prefix, context) => {
      if (context?.previousKeys) {
        queryClient.setQueryData(queryKeys.apiKeys.list(), context.previousKeys);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
}
