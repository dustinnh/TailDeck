import { z } from 'zod';

/**
 * Zod schemas for validating Headscale API responses
 *
 * IMPORTANT: Headscale v0.23+ REST API returns:
 * - camelCase field names (e.g., createdAt, displayName)
 * - ISO 8601 date strings for timestamps (e.g., "2025-11-30T18:52:46.063023138Z")
 */

/**
 * Timestamp schema - accepts ISO 8601 date string from Headscale REST API
 * Transforms to { seconds, nanos } format for internal consistency
 */
export const timestampSchema = z.string().transform((dateStr) => {
  const date = new Date(dateStr);
  const seconds = Math.floor(date.getTime() / 1000).toString();
  const nanos = (date.getTime() % 1000) * 1000000;
  return { seconds, nanos };
});

/**
 * Headscale User schema
 * Headscale v0.23+ returns camelCase: createdAt, displayName
 */
const headscaleUserRawSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: timestampSchema,
  displayName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export const headscaleUserSchema = headscaleUserRawSchema.transform((data) => ({
  id: data.id,
  name: data.name,
  createdAt: data.createdAt,
  displayName: data.displayName ?? undefined,
  email: data.email ?? undefined,
}));

/**
 * Register method enum
 */
export const registerMethodSchema = z.enum([
  'REGISTER_METHOD_UNSPECIFIED',
  'REGISTER_METHOD_AUTH_KEY',
  'REGISTER_METHOD_CLI',
  'REGISTER_METHOD_OIDC',
]);

/**
 * Headscale Node schema
 * Headscale v0.23+ returns camelCase fields
 */
const headscaleNodeRawSchema = z.object({
  id: z.string(),
  machineKey: z.string(),
  nodeKey: z.string(),
  ipAddresses: z.array(z.string()),
  name: z.string(),
  user: headscaleUserRawSchema,
  lastSeen: timestampSchema,
  expiry: timestampSchema,
  forcedTags: z.array(z.string()),
  validTags: z.array(z.string()),
  givenName: z.string(),
  online: z.boolean(),
  registerMethod: registerMethodSchema,
  createdAt: timestampSchema.optional(),
});

export const headscaleNodeSchema = headscaleNodeRawSchema.transform((data) => ({
  id: data.id,
  machineKey: data.machineKey,
  nodeKey: data.nodeKey,
  ipAddresses: data.ipAddresses,
  name: data.name,
  user: {
    id: data.user.id,
    name: data.user.name,
    createdAt: data.user.createdAt,
    displayName: data.user.displayName ?? undefined,
    email: data.user.email ?? undefined,
  },
  lastSeen: data.lastSeen,
  expiry: data.expiry,
  forcedTags: data.forcedTags,
  validTags: data.validTags,
  givenName: data.givenName,
  online: data.online,
  registerMethod: data.registerMethod,
  createdAt: data.createdAt,
}));

/**
 * List Nodes Response schema
 */
export const listNodesResponseSchema = z
  .object({
    nodes: z.array(headscaleNodeRawSchema),
  })
  .transform((data) => ({
    nodes: data.nodes.map((node) => ({
      id: node.id,
      machineKey: node.machineKey,
      nodeKey: node.nodeKey,
      ipAddresses: node.ipAddresses,
      name: node.name,
      user: {
        id: node.user.id,
        name: node.user.name,
        createdAt: node.user.createdAt,
        displayName: node.user.displayName ?? undefined,
        email: node.user.email ?? undefined,
      },
      lastSeen: node.lastSeen,
      expiry: node.expiry,
      forcedTags: node.forcedTags,
      validTags: node.validTags,
      givenName: node.givenName,
      online: node.online,
      registerMethod: node.registerMethod,
      createdAt: node.createdAt,
    })),
  }));

/**
 * Get Node Response schema
 */
export const getNodeResponseSchema = z
  .object({
    node: headscaleNodeRawSchema,
  })
  .transform((data) => ({
    node: {
      id: data.node.id,
      machineKey: data.node.machineKey,
      nodeKey: data.node.nodeKey,
      ipAddresses: data.node.ipAddresses,
      name: data.node.name,
      user: {
        id: data.node.user.id,
        name: data.node.user.name,
        createdAt: data.node.user.createdAt,
        displayName: data.node.user.displayName ?? undefined,
        email: data.node.user.email ?? undefined,
      },
      lastSeen: data.node.lastSeen,
      expiry: data.node.expiry,
      forcedTags: data.node.forcedTags,
      validTags: data.node.validTags,
      givenName: data.node.givenName,
      online: data.node.online,
      registerMethod: data.node.registerMethod,
      createdAt: data.node.createdAt,
    },
  }));

/**
 * List Users Response schema
 */
export const listUsersResponseSchema = z
  .object({
    users: z.array(headscaleUserRawSchema),
  })
  .transform((data) => ({
    users: data.users.map((user) => ({
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      displayName: user.displayName ?? undefined,
      email: user.email ?? undefined,
    })),
  }));

/**
 * Error Response schema
 */
export const headscaleErrorResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  details: z.array(z.unknown()).optional(),
});

/**
 * Headscale Route schema
 * Headscale v0.23+ returns camelCase fields
 */
const headscaleRouteRawSchema = z.object({
  id: z.string(),
  node: headscaleNodeRawSchema,
  prefix: z.string(),
  advertised: z.boolean(),
  enabled: z.boolean(),
  isPrimary: z.boolean(),
  createdAt: timestampSchema.optional(),
  updatedAt: timestampSchema.optional(),
  deletedAt: timestampSchema.optional(),
});

export const headscaleRouteSchema = headscaleRouteRawSchema.transform((data) => ({
  id: data.id,
  node: {
    id: data.node.id,
    machineKey: data.node.machineKey,
    nodeKey: data.node.nodeKey,
    ipAddresses: data.node.ipAddresses,
    name: data.node.name,
    user: {
      id: data.node.user.id,
      name: data.node.user.name,
      createdAt: data.node.user.createdAt,
      displayName: data.node.user.displayName ?? undefined,
      email: data.node.user.email ?? undefined,
    },
    lastSeen: data.node.lastSeen,
    expiry: data.node.expiry,
    forcedTags: data.node.forcedTags,
    validTags: data.node.validTags,
    givenName: data.node.givenName,
    online: data.node.online,
    registerMethod: data.node.registerMethod,
    createdAt: data.node.createdAt,
  },
  prefix: data.prefix,
  advertised: data.advertised,
  enabled: data.enabled,
  isPrimary: data.isPrimary,
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
  deletedAt: data.deletedAt,
}));

/**
 * List Routes Response schema
 */
export const listRoutesResponseSchema = z
  .object({
    routes: z.array(headscaleRouteRawSchema),
  })
  .transform((data) => ({
    routes: data.routes.map((route) => ({
      id: route.id,
      node: {
        id: route.node.id,
        machineKey: route.node.machineKey,
        nodeKey: route.node.nodeKey,
        ipAddresses: route.node.ipAddresses,
        name: route.node.name,
        user: {
          id: route.node.user.id,
          name: route.node.user.name,
          createdAt: route.node.user.createdAt,
          displayName: route.node.user.displayName ?? undefined,
          email: route.node.user.email ?? undefined,
        },
        lastSeen: route.node.lastSeen,
        expiry: route.node.expiry,
        forcedTags: route.node.forcedTags,
        validTags: route.node.validTags,
        givenName: route.node.givenName,
        online: route.node.online,
        registerMethod: route.node.registerMethod,
        createdAt: route.node.createdAt,
      },
      prefix: route.prefix,
      advertised: route.advertised,
      enabled: route.enabled,
      isPrimary: route.isPrimary,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      deletedAt: route.deletedAt,
    })),
  }));

/**
 * Get Route Response schema
 */
export const getRouteResponseSchema = z
  .object({
    route: headscaleRouteRawSchema,
  })
  .transform((data) => ({
    route: {
      id: data.route.id,
      node: {
        id: data.route.node.id,
        machineKey: data.route.node.machineKey,
        nodeKey: data.route.node.nodeKey,
        ipAddresses: data.route.node.ipAddresses,
        name: data.route.node.name,
        user: {
          id: data.route.node.user.id,
          name: data.route.node.user.name,
          createdAt: data.route.node.user.createdAt,
          displayName: data.route.node.user.displayName ?? undefined,
          email: data.route.node.user.email ?? undefined,
        },
        lastSeen: data.route.node.lastSeen,
        expiry: data.route.node.expiry,
        forcedTags: data.route.node.forcedTags,
        validTags: data.route.node.validTags,
        givenName: data.route.node.givenName,
        online: data.route.node.online,
        registerMethod: data.route.node.registerMethod,
        createdAt: data.route.node.createdAt,
      },
      prefix: data.route.prefix,
      advertised: data.route.advertised,
      enabled: data.route.enabled,
      isPrimary: data.route.isPrimary,
      createdAt: data.route.createdAt,
      updatedAt: data.route.updatedAt,
      deletedAt: data.route.deletedAt,
    },
  }));

/**
 * Headscale PreAuthKey schema
 * Headscale v0.23+ returns camelCase fields
 */
const headscalePreAuthKeyRawSchema = z.object({
  id: z.string(),
  key: z.string(),
  user: z.string(),
  reusable: z.boolean(),
  ephemeral: z.boolean(),
  used: z.boolean(),
  expiration: timestampSchema,
  createdAt: timestampSchema,
  aclTags: z.array(z.string()),
});

export const headscalePreAuthKeySchema = headscalePreAuthKeyRawSchema.transform((data) => ({
  id: data.id,
  key: data.key,
  user: data.user,
  reusable: data.reusable,
  ephemeral: data.ephemeral,
  used: data.used,
  expiration: data.expiration,
  createdAt: data.createdAt,
  aclTags: data.aclTags,
}));

/**
 * List PreAuthKeys Response schema
 */
export const listPreAuthKeysResponseSchema = z
  .object({
    preAuthKeys: z.array(headscalePreAuthKeyRawSchema),
  })
  .transform((data) => ({
    preAuthKeys: data.preAuthKeys.map((key) => ({
      id: key.id,
      key: key.key,
      user: key.user,
      reusable: key.reusable,
      ephemeral: key.ephemeral,
      used: key.used,
      expiration: key.expiration,
      createdAt: key.createdAt,
      aclTags: key.aclTags,
    })),
  }));

/**
 * Create PreAuthKey Response schema
 */
export const createPreAuthKeyResponseSchema = z
  .object({
    preAuthKey: headscalePreAuthKeyRawSchema,
  })
  .transform((data) => ({
    preAuthKey: {
      id: data.preAuthKey.id,
      key: data.preAuthKey.key,
      user: data.preAuthKey.user,
      reusable: data.preAuthKey.reusable,
      ephemeral: data.preAuthKey.ephemeral,
      used: data.preAuthKey.used,
      expiration: data.preAuthKey.expiration,
      createdAt: data.preAuthKey.createdAt,
      aclTags: data.preAuthKey.aclTags,
    },
  }));

/**
 * Get User Response schema
 */
export const getUserResponseSchema = z
  .object({
    user: headscaleUserRawSchema,
  })
  .transform((data) => ({
    user: {
      id: data.user.id,
      name: data.user.name,
      createdAt: data.user.createdAt,
      displayName: data.user.displayName ?? undefined,
      email: data.user.email ?? undefined,
    },
  }));

/**
 * Create User Response schema
 */
export const createUserResponseSchema = z
  .object({
    user: headscaleUserRawSchema,
  })
  .transform((data) => ({
    user: {
      id: data.user.id,
      name: data.user.name,
      createdAt: data.user.createdAt,
      displayName: data.user.displayName ?? undefined,
      email: data.user.email ?? undefined,
    },
  }));

/**
 * Get Policy Response schema
 * Headscale v0.23+ returns camelCase: updatedAt
 */
export const getPolicyResponseSchema = z
  .object({
    policy: z.string(),
    updatedAt: timestampSchema.optional(),
  })
  .transform((data) => ({
    policy: data.policy,
    updatedAt: data.updatedAt,
  }));

/**
 * Set Policy Response schema
 */
export const setPolicyResponseSchema = z
  .object({
    policy: z.string(),
    updatedAt: timestampSchema.optional(),
  })
  .transform((data) => ({
    policy: data.policy,
    updatedAt: data.updatedAt,
  }));

// =========================
// API Key Schemas
// =========================

/**
 * Headscale API Key schema
 * Headscale v0.23+ returns camelCase fields
 */
const headscaleApiKeyRawSchema = z.object({
  id: z.string(),
  prefix: z.string(),
  expiration: timestampSchema,
  createdAt: timestampSchema,
  lastSeen: timestampSchema.nullable().optional(),
});

export const headscaleApiKeySchema = headscaleApiKeyRawSchema.transform((data) => ({
  id: data.id,
  prefix: data.prefix,
  expiration: data.expiration,
  createdAt: data.createdAt,
  lastSeen: data.lastSeen,
}));

/**
 * List API Keys Response schema
 */
export const listApiKeysResponseSchema = z
  .object({
    apiKeys: z.array(headscaleApiKeyRawSchema),
  })
  .transform((data) => ({
    apiKeys: data.apiKeys.map((key) => ({
      id: key.id,
      prefix: key.prefix,
      expiration: key.expiration,
      createdAt: key.createdAt,
      lastSeen: key.lastSeen,
    })),
  }));

/**
 * Create API Key Response schema
 * Note: Returns the full API key only once
 */
export const createApiKeyResponseSchema = z.object({
  apiKey: z.string(),
});

/**
 * Expire API Key Response schema
 */
export const expireApiKeyResponseSchema = z.object({});

// =========================
// DNS Schemas
// =========================

/**
 * DNS Configuration schema
 */
export const dnsConfigurationSchema = z.object({
  nameservers: z.array(z.string()).optional().default([]),
  domains: z.array(z.string()).optional().default([]),
  magicDNS: z.boolean().optional().default(false),
  baseDomain: z.string().optional(),
});

/**
 * Get DNS Response schema
 */
export const getDNSResponseSchema = z
  .object({
    dns: dnsConfigurationSchema.optional(),
  })
  .transform((data) => ({
    dns: data.dns ?? {
      nameservers: [],
      domains: [],
      magicDNS: false,
    },
  }));

// =========================
// Bulk Operation Schemas
// =========================

/**
 * Bulk Operation Request schema (for validation)
 */
export const bulkOperationRequestSchema = z
  .object({
    action: z.enum(['delete', 'expire', 'move', 'tags']),
    nodeIds: z.array(z.string()).min(1, 'At least one node ID is required'),
    newUser: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      // Validate action-specific required fields
      if (data.action === 'move' && !data.newUser) {
        return false;
      }
      if (data.action === 'tags' && !data.tags) {
        return false;
      }
      return true;
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );
