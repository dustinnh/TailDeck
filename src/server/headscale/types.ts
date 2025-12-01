/**
 * Headscale API Type Definitions
 * These types match the Headscale REST API responses
 *
 * @see https://headscale.net/ref/api/
 */

/**
 * Timestamp as returned by Headscale API
 */
export interface Timestamp {
  seconds: string;
  nanos: number;
}

/**
 * Headscale User (namespace)
 */
export interface HeadscaleUser {
  id: string;
  name: string;
  createdAt: Timestamp;
  displayName?: string;
  email?: string;
}

/**
 * Headscale Node (machine)
 * Updated for Headscale 0.27+ which includes routes in the node object
 */
export interface HeadscaleNode {
  id: string;
  machineKey: string;
  nodeKey: string;
  ipAddresses: string[];
  name: string;
  user: HeadscaleUser;
  lastSeen: Timestamp;
  expiry: Timestamp;
  forcedTags: string[];
  validTags: string[];
  givenName: string;
  online: boolean;
  registerMethod: RegisterMethod;
  createdAt?: Timestamp;
  // Route fields added in Headscale 0.27+
  availableRoutes?: string[];
  approvedRoutes?: string[];
  subnetRoutes?: string[];
}

/**
 * How a node was registered
 */
export type RegisterMethod =
  | 'REGISTER_METHOD_UNSPECIFIED'
  | 'REGISTER_METHOD_AUTH_KEY'
  | 'REGISTER_METHOD_CLI'
  | 'REGISTER_METHOD_OIDC';

/**
 * API Response: List Nodes
 */
export interface ListNodesResponse {
  nodes: HeadscaleNode[];
}

/**
 * API Response: Get Node
 */
export interface GetNodeResponse {
  node: HeadscaleNode;
}

/**
 * API Response: List Users
 */
export interface ListUsersResponse {
  users: HeadscaleUser[];
}

/**
 * Headscale API Error Response
 */
export interface HeadscaleErrorResponse {
  code: number;
  message: string;
  details?: unknown[];
}

/**
 * Headscale Route
 */
export interface HeadscaleRoute {
  id: string;
  node: HeadscaleNode;
  prefix: string;
  advertised: boolean;
  enabled: boolean;
  isPrimary: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp;
}

/**
 * API Response: List Routes
 */
export interface ListRoutesResponse {
  routes: HeadscaleRoute[];
}

/**
 * API Response: Get Route
 */
export interface GetRouteResponse {
  route: HeadscaleRoute;
}

/**
 * Headscale PreAuthKey
 */
export interface HeadscalePreAuthKey {
  id: string;
  key: string;
  user: string;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: Timestamp;
  createdAt: Timestamp;
  aclTags: string[];
}

/**
 * API Response: List PreAuthKeys
 */
export interface ListPreAuthKeysResponse {
  preAuthKeys: HeadscalePreAuthKey[];
}

/**
 * API Response: Create PreAuthKey
 */
export interface CreatePreAuthKeyResponse {
  preAuthKey: HeadscalePreAuthKey;
}

/**
 * Parameters for creating a PreAuthKey
 */
export interface CreatePreAuthKeyParams {
  user: string;
  reusable?: boolean;
  ephemeral?: boolean;
  expiration?: string;
  aclTags?: string[];
}

/**
 * API Response: Get User
 */
export interface GetUserResponse {
  user: HeadscaleUser;
}

/**
 * API Response: Create User
 */
export interface CreateUserResponse {
  user: HeadscaleUser;
}

/**
 * API Response: Policy (ACL)
 */
export interface GetPolicyResponse {
  policy: string;
  updatedAt?: Timestamp;
}

/**
 * API Response: Set Policy
 */
export interface SetPolicyResponse {
  policy: string;
  updatedAt?: Timestamp;
}

/**
 * Headscale API Key
 */
export interface HeadscaleApiKey {
  id: string;
  prefix: string;
  expiration: Timestamp;
  createdAt: Timestamp;
  lastSeen?: Timestamp | null;
}

/**
 * API Response: List API Keys
 */
export interface ListApiKeysResponse {
  apiKeys: HeadscaleApiKey[];
}

/**
 * API Response: Create API Key
 * Note: The full API key is only returned once on creation
 */
export interface CreateApiKeyResponse {
  apiKey: string;
}

/**
 * Parameters for creating an API Key
 */
export interface CreateApiKeyParams {
  expiration?: string; // ISO date string
}

/**
 * DNS Configuration
 */
export interface DNSConfiguration {
  nameservers: string[];
  domains: string[];
  magicDNS: boolean;
  baseDomain?: string;
}

/**
 * API Response: Get DNS Configuration
 */
export interface GetDNSResponse {
  dns: DNSConfiguration;
}

/**
 * Bulk Operation Action Types
 */
export type BulkAction = 'delete' | 'expire' | 'move' | 'tags';

/**
 * Bulk Operation Request
 */
export interface BulkOperationRequest {
  action: BulkAction;
  nodeIds: string[];
  // Action-specific params
  newUser?: string; // for 'move'
  tags?: string[]; // for 'tags'
}

/**
 * Individual result of a bulk operation
 */
export interface BulkOperationResult {
  nodeId: string;
  success: boolean;
  error?: string;
}

/**
 * Bulk Operation Response
 */
export interface BulkOperationResponse {
  results: BulkOperationResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
