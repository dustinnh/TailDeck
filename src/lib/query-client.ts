/**
 * TanStack Query Client Configuration
 *
 * Centralized query client with sensible defaults for TailDeck.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Create a new QueryClient instance with default options
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30 seconds
        staleTime: 30 * 1000,
        // Cache data for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry failed requests 3 times
        retry: 3,
        // Don't refetch on window focus by default
        refetchOnWindowFocus: false,
        // Don't refetch when reconnecting
        refetchOnReconnect: false,
      },
      mutations: {
        // Don't retry mutations by default
        retry: false,
      },
    },
  });
}

/**
 * Query client singleton for server components
 * Note: This should only be used in server-side code
 */
let serverQueryClient: QueryClient | undefined;

export function getServerQueryClient() {
  if (!serverQueryClient) {
    serverQueryClient = createQueryClient();
  }
  return serverQueryClient;
}
