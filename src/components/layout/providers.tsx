'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';

import { createQueryClient } from '@/lib/query-client';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Client-side providers wrapper
 *
 * Wraps the application with necessary providers:
 * - SessionProvider: Provides authentication session to client components
 * - QueryClientProvider: Provides TanStack Query for data fetching
 */
export function Providers({ children }: ProvidersProps) {
  // Create a stable QueryClient instance per browser session
  // Using useState ensures the client persists across re-renders
  const [queryClient] = useState(() => createQueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
