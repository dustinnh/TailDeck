'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';

// ============================================
// Types
// ============================================

interface SetupStatus {
  isComplete: boolean;
  completedAt: string | null;
  completedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  setupVersion: number;
  dismissedWarnings: string[];
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
  latencyMs?: number;
}

interface SecurityWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  remediation?: string;
  canDismiss: boolean;
}

interface SystemDiagnostics {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp: string;
  services: {
    database: ServiceHealth;
    headscale: ServiceHealth;
    oidc: ServiceHealth;
  };
  counts: {
    nodes: number;
    users: number;
    routes: number;
  };
  securityWarnings: SecurityWarning[];
  environment: {
    nodeEnv: string;
    authUrl: string;
    headscaleUrl: string;
    magicDnsEnabled: boolean;
    magicDnsDomain?: string;
  };
}

interface VerifyResult {
  verified: boolean;
  message: string;
  statusCode?: number;
  latencyMs?: number;
}

// ============================================
// Hooks
// ============================================

/**
 * Hook to fetch setup status
 */
export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: queryKeys.setup.status(),
    queryFn: async () => {
      const response = await fetch('/api/setup');
      if (!response.ok) {
        throw new Error('Failed to fetch setup status');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch system diagnostics
 */
export function useDiagnostics() {
  return useQuery<SystemDiagnostics>({
    queryKey: queryKeys.setup.diagnostics(),
    queryFn: async () => {
      const response = await fetch('/api/setup/diagnostics');
      if (!response.ok) {
        throw new Error('Failed to fetch diagnostics');
      }
      return response.json();
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to check a specific service
 */
export function useServiceHealth(service: 'database' | 'headscale' | 'oidc') {
  return useQuery<ServiceHealth>({
    queryKey: queryKeys.setup.service(service),
    queryFn: async () => {
      const response = await fetch(`/api/setup/diagnostics?service=${service}`);
      if (!response.ok) {
        throw new Error(`Failed to check ${service} health`);
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to complete setup
 */
export function useCompleteSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete setup');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.all });
    },
  });
}

/**
 * Hook to reset setup
 */
export function useResetSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset setup');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.all });
    },
  });
}

/**
 * Hook to dismiss a security warning
 */
export function useDismissWarning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (warningId: string) => {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss-warning', warningId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to dismiss warning');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.all });
    },
  });
}

/**
 * Hook to verify a URL or service
 */
export function useVerify() {
  return useMutation<
    VerifyResult,
    Error,
    { type: 'url' | 'dns' | 'service'; value?: string; service?: string }
  >({
    mutationFn: async (params) => {
      const response = await fetch('/api/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      return data;
    },
  });
}
