/**
 * DNS Configuration Query Hooks
 *
 * TanStack Query hooks for DNS operations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../query-keys';

/**
 * DNS Configuration type
 */
export interface DNSConfiguration {
  nameservers: string[];
  domains: string[];
  magicDNS: boolean;
  baseDomain?: string;
}

/**
 * API client for DNS operations
 */
const api = {
  async getDNS(): Promise<{ dns: DNSConfiguration }> {
    const res = await fetch('/api/headscale/dns');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch DNS configuration');
    }
    return res.json();
  },

  async updateDNS(config: Partial<DNSConfiguration>): Promise<{ dns: DNSConfiguration }> {
    const res = await fetch('/api/headscale/dns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update DNS configuration');
    }
    return res.json();
  },
};

/**
 * Fetch DNS configuration
 */
export function useDNS() {
  return useQuery({
    queryKey: queryKeys.dns.config(),
    queryFn: async () => {
      const data = await api.getDNS();
      return data.dns;
    },
  });
}

/**
 * Update DNS configuration
 */
export function useUpdateDNS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<DNSConfiguration>) => api.updateDNS(config),

    onMutate: async (newConfig) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.dns.config() });

      // Snapshot previous value
      const previousDNS = queryClient.getQueryData<DNSConfiguration>(queryKeys.dns.config());

      // Optimistically update the cache
      if (previousDNS) {
        queryClient.setQueryData<DNSConfiguration>(queryKeys.dns.config(), {
          ...previousDNS,
          ...newConfig,
        });
      }

      return { previousDNS };
    },

    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousDNS) {
        queryClient.setQueryData(queryKeys.dns.config(), context.previousDNS);
      }
    },

    onSettled: () => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.dns.all });
    },
  });
}
