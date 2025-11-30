/**
 * Headscale Users Query Hooks
 *
 * TanStack Query hooks for Headscale user/namespace operations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../query-keys';

/**
 * Headscale User type
 */
export interface HeadscaleUser {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * API client for user operations
 */
const api = {
  async listUsers(): Promise<{ users: HeadscaleUser[] }> {
    const res = await fetch('/api/headscale/users');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch users');
    }
    return res.json();
  },

  async createUser(name: string): Promise<{ user: HeadscaleUser }> {
    const res = await fetch('/api/headscale/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create user');
    }
    return res.json();
  },

  async deleteUser(name: string): Promise<void> {
    const res = await fetch(`/api/headscale/users/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete user');
    }
  },
};

/**
 * Fetch all Headscale users (namespaces)
 */
export function useHeadscaleUsers() {
  return useQuery({
    queryKey: queryKeys.headscaleUsers.list(),
    queryFn: async () => {
      const data = await api.listUsers();
      return data.users;
    },
  });
}

/**
 * Create a new Headscale user
 */
export function useCreateHeadscaleUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.createUser(name),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.headscaleUsers.all });
    },
  });
}

/**
 * Delete a Headscale user
 */
export function useDeleteHeadscaleUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.deleteUser(name),

    onMutate: async (name) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.headscaleUsers.list(),
      });

      const previousUsers = queryClient.getQueryData<HeadscaleUser[]>(
        queryKeys.headscaleUsers.list()
      );

      if (previousUsers) {
        queryClient.setQueryData<HeadscaleUser[]>(
          queryKeys.headscaleUsers.list(),
          previousUsers.filter((user) => user.name !== name)
        );
      }

      return { previousUsers };
    },

    onError: (_err, _name, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.headscaleUsers.list(), context.previousUsers);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.headscaleUsers.all });
    },
  });
}
