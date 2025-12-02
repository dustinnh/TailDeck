/**
 * Authentik API Types
 *
 * SERVER-ONLY: This file must NEVER be imported by client components.
 * Type definitions for the Authentik v3 API.
 */

// ============================================
// Flow Types
// ============================================

export interface Flow {
  pk: string;
  name: string;
  slug: string;
  designation:
    | 'authentication'
    | 'authorization'
    | 'enrollment'
    | 'invalidation'
    | 'recovery'
    | 'stage_configuration'
    | 'unenrollment';
  title: string;
  background: string;
  policy_engine_mode: 'all' | 'any';
  compatibility_mode: boolean;
  denied_action: string;
}

export interface FlowListResponse {
  pagination: Pagination;
  results: Flow[];
}

// ============================================
// Property Mapping Types
// ============================================

export interface ScopeMapping {
  pk: string;
  managed: string | null;
  name: string;
  expression: string;
  scope_name: string;
  description: string;
}

export interface ScopeMappingListResponse {
  pagination: Pagination;
  results: ScopeMapping[];
}

// ============================================
// OAuth2 Provider Types
// ============================================

export interface RedirectURI {
  matching_mode: 'strict' | 'regex';
  url: string;
}

export interface OAuth2Provider {
  pk: number;
  name: string;
  authorization_flow: string;
  client_type: 'confidential' | 'public';
  client_id: string;
  client_secret?: string;
  redirect_uris: string; // String format in Authentik API
  access_token_validity: string;
  refresh_token_validity: string;
  include_claims_in_id_token: boolean;
  property_mappings: string[];
  signing_key?: string | null;
  sub_mode?:
    | 'hashed_user_id'
    | 'user_id'
    | 'user_uuid'
    | 'user_username'
    | 'user_email'
    | 'user_upn';
  issuer_mode?: 'global' | 'per_provider';
}

export interface OAuth2ProviderCreateRequest {
  name: string;
  authorization_flow: string;
  client_type: 'confidential' | 'public';
  client_id?: string;
  client_secret?: string;
  redirect_uris: string; // Newline-separated URIs string for API
  access_token_validity?: string;
  refresh_token_validity?: string;
  include_claims_in_id_token?: boolean;
  property_mappings?: string[];
  signing_key?: string | null;
  sub_mode?:
    | 'hashed_user_id'
    | 'user_id'
    | 'user_uuid'
    | 'user_username'
    | 'user_email'
    | 'user_upn';
  issuer_mode?: 'global' | 'per_provider';
}

export interface OAuth2ProviderListResponse {
  pagination: Pagination;
  results: OAuth2Provider[];
}

// ============================================
// Application Types
// ============================================

export interface Application {
  pk: string;
  name: string;
  slug: string;
  provider?: number | null;
  provider_obj?: OAuth2Provider | null;
  launch_url?: string | null;
  open_in_new_tab: boolean;
  meta_launch_url?: string;
  meta_description?: string;
  meta_publisher?: string;
  policy_engine_mode: 'all' | 'any';
  group?: string;
}

export interface ApplicationCreateRequest {
  name: string;
  slug: string;
  provider?: number;
  meta_launch_url?: string;
  meta_description?: string;
  meta_publisher?: string;
  policy_engine_mode?: 'all' | 'any';
  group?: string;
}

export interface ApplicationListResponse {
  pagination: Pagination;
  results: Application[];
}

// ============================================
// Group Types
// ============================================

export interface Group {
  pk: string;
  num_pk: number;
  name: string;
  is_superuser: boolean;
  parent?: string | null;
  parent_name?: string | null;
  users: number[];
  attributes: Record<string, unknown>;
  users_obj?: { pk: number; username: string; name: string; is_active: boolean; email: string }[];
}

export interface GroupCreateRequest {
  name: string;
  is_superuser?: boolean;
  parent?: string | null;
  attributes?: Record<string, unknown>;
}

export interface GroupListResponse {
  pagination: Pagination;
  results: Group[];
}

// ============================================
// User Types
// ============================================

export interface AuthentikUser {
  pk: number;
  username: string;
  name: string;
  is_active: boolean;
  last_login?: string | null;
  is_superuser: boolean;
  groups: string[];
  groups_obj?: Group[];
  email: string;
  avatar: string;
  attributes: Record<string, unknown>;
  uid: string;
  path: string;
  type: 'internal' | 'external' | 'service_account' | 'internal_service_account';
}

export interface AuthentikUserListResponse {
  pagination: Pagination;
  results: AuthentikUser[];
}

// ============================================
// Common Types
// ============================================

export interface Pagination {
  next: number | null;
  previous: number | null;
  count: number;
  current: number;
  total_pages: number;
  start_index: number;
  end_index: number;
}

export interface APIError {
  detail?: string;
  code?: string;
  non_field_errors?: string[];
  [field: string]: unknown;
}

// ============================================
// Configuration Result Types
// ============================================

export interface AuthentikSetupResult {
  success: boolean;
  providerId?: number;
  applicationSlug?: string;
  clientId: string;
  clientSecret?: string;
  groups: string[];
  error?: string;
}

export interface AuthentikHealthStatus {
  healthy: boolean;
  apiReachable: boolean;
  version?: string;
  error?: string;
}
