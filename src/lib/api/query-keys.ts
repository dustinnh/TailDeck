/**
 * Query Key Factory
 *
 * Centralized query keys for type-safe cache management.
 * Using the factory pattern ensures consistent key structure across the app.
 */

/**
 * Query keys for all data fetching operations
 */
export const queryKeys = {
  // Node/Machine queries
  nodes: {
    all: ['nodes'] as const,
    list: () => [...queryKeys.nodes.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.nodes.all, 'detail', id] as const,
    byUser: (userId: string) => [...queryKeys.nodes.all, 'byUser', userId] as const,
  },

  // Route queries
  routes: {
    all: ['routes'] as const,
    list: () => [...queryKeys.routes.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.routes.all, 'detail', id] as const,
    byNode: (nodeId: string) => [...queryKeys.routes.all, 'byNode', nodeId] as const,
  },

  // Headscale user queries (not TailDeck users)
  headscaleUsers: {
    all: ['headscaleUsers'] as const,
    list: () => [...queryKeys.headscaleUsers.all, 'list'] as const,
    detail: (name: string) => [...queryKeys.headscaleUsers.all, 'detail', name] as const,
  },

  // PreAuth key queries
  keys: {
    all: ['keys'] as const,
    list: () => [...queryKeys.keys.all, 'list'] as const,
    byUser: (user: string) => [...queryKeys.keys.all, 'byUser', user] as const,
  },

  // ACL/Policy queries
  policy: {
    all: ['policy'] as const,
    current: () => [...queryKeys.policy.all, 'current'] as const,
  },

  // Audit log queries
  auditLogs: {
    all: ['auditLogs'] as const,
    list: (params?: { action?: string; resourceType?: string; userId?: string }) =>
      [...queryKeys.auditLogs.all, 'list', params] as const,
    recent: (limit?: number) => [...queryKeys.auditLogs.all, 'recent', limit] as const,
    byResource: (type: string, id: string) =>
      [...queryKeys.auditLogs.all, 'byResource', type, id] as const,
  },

  // Health/status queries
  health: {
    all: ['health'] as const,
    status: () => [...queryKeys.health.all, 'status'] as const,
  },

  // TailDeck user queries (for admin)
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
    roles: (id: string) => [...queryKeys.users.all, 'roles', id] as const,
  },

  // DNS configuration queries
  dns: {
    all: ['dns'] as const,
    config: () => [...queryKeys.dns.all, 'config'] as const,
  },

  // API key queries
  apiKeys: {
    all: ['apiKeys'] as const,
    list: () => [...queryKeys.apiKeys.all, 'list'] as const,
  },

  // Flow log queries
  flowLogs: {
    all: ['flowLogs'] as const,
    query: (params?: {
      query?: string;
      start?: string;
      end?: string;
      limit?: number;
      direction?: 'forward' | 'backward';
    }) => [...queryKeys.flowLogs.all, 'query', params] as const,
    labels: (timeRange?: { start?: string; end?: string }) =>
      [...queryKeys.flowLogs.all, 'labels', timeRange] as const,
    labelValues: (labelName: string, timeRange?: { start?: string; end?: string }) =>
      [...queryKeys.flowLogs.all, 'labelValues', labelName, timeRange] as const,
    health: () => [...queryKeys.flowLogs.all, 'health'] as const,
  },

  // Setup wizard queries
  setup: {
    all: ['setup'] as const,
    status: () => [...queryKeys.setup.all, 'status'] as const,
    diagnostics: () => [...queryKeys.setup.all, 'diagnostics'] as const,
    service: (name: string) => [...queryKeys.setup.all, 'service', name] as const,
    warnings: () => [...queryKeys.setup.all, 'warnings'] as const,
  },

  // Public configuration queries
  config: {
    all: ['config'] as const,
    public: () => [...queryKeys.config.all, 'public'] as const,
  },
} as const;

/**
 * Type helper for extracting query key types
 */
export type QueryKeys = typeof queryKeys;
