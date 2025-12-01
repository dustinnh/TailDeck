/**
 * Authentik API Response Schemas
 *
 * SERVER-ONLY: This file must NEVER be imported by client components.
 * Zod schemas for validating Authentik API responses.
 */

import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const paginationSchema = z.object({
  next: z.number().nullable(),
  previous: z.number().nullable(),
  count: z.number(),
  current: z.number(),
  total_pages: z.number(),
  start_index: z.number(),
  end_index: z.number(),
});

// ============================================
// Flow Schemas
// ============================================

export const flowSchema = z.object({
  pk: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  designation: z.enum([
    'authentication',
    'authorization',
    'enrollment',
    'invalidation',
    'recovery',
    'stage_configuration',
    'unenrollment',
  ]),
  title: z.string(),
  background: z.string(),
  policy_engine_mode: z.enum(['all', 'any']),
  compatibility_mode: z.boolean(),
  denied_action: z.string(),
});

export const flowListResponseSchema = z.object({
  pagination: paginationSchema,
  results: z.array(flowSchema),
});

// ============================================
// Scope Mapping Schemas
// ============================================

export const scopeMappingSchema = z.object({
  pk: z.string().uuid(),
  managed: z.string().nullable(),
  name: z.string(),
  expression: z.string(),
  scope_name: z.string(),
  description: z.string(),
});

export const scopeMappingListResponseSchema = z.object({
  pagination: paginationSchema,
  results: z.array(scopeMappingSchema),
});

// ============================================
// OAuth2 Provider Schemas
// ============================================

export const redirectUriSchema = z.object({
  matching_mode: z.enum(['strict', 'regex']),
  url: z.string(),
});

export const oauth2ProviderSchema = z.object({
  pk: z.number(),
  name: z.string(),
  authorization_flow: z.string().uuid(),
  client_type: z.enum(['confidential', 'public']),
  client_id: z.string(),
  client_secret: z.string().optional(),
  redirect_uris: z.string(), // String format in Authentik 2024.2.2
  access_token_validity: z.string(),
  refresh_token_validity: z.string(),
  include_claims_in_id_token: z.boolean(),
  property_mappings: z.array(z.string().uuid()),
  signing_key: z.string().uuid().nullable().optional(),
  sub_mode: z
    .enum(['hashed_user_id', 'user_id', 'user_uuid', 'user_username', 'user_email', 'user_upn'])
    .optional(),
  issuer_mode: z.enum(['global', 'per_provider']).optional(),
});

export const oauth2ProviderListResponseSchema = z.object({
  pagination: paginationSchema,
  results: z.array(oauth2ProviderSchema),
});

export const oauth2ProviderCreateResponseSchema = oauth2ProviderSchema;

// ============================================
// Application Schemas
// ============================================

export const applicationSchema = z.object({
  pk: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  provider: z.number().nullable().optional(),
  provider_obj: z.any().nullable().optional(), // Generic object - provider types vary
  launch_url: z.string().nullable().optional(),
  open_in_new_tab: z.boolean(),
  meta_launch_url: z.string().optional(),
  meta_description: z.string().optional(),
  meta_publisher: z.string().optional(),
  policy_engine_mode: z.enum(['all', 'any']),
  group: z.string().optional(),
});

export const applicationListResponseSchema = z.object({
  pagination: paginationSchema,
  results: z.array(applicationSchema),
});

export const applicationCreateResponseSchema = applicationSchema;

// ============================================
// Group Schemas
// ============================================

export const groupUserSchema = z.object({
  pk: z.number(),
  username: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  email: z.string(),
});

export const groupSchema = z.object({
  pk: z.string().uuid(),
  num_pk: z.number(),
  name: z.string(),
  is_superuser: z.boolean(),
  parent: z.string().uuid().nullable().optional(),
  parent_name: z.string().nullable().optional(),
  users: z.array(z.number()),
  attributes: z.record(z.string(), z.unknown()),
  users_obj: z.array(groupUserSchema).optional(),
});

export const groupListResponseSchema = z.object({
  pagination: paginationSchema,
  results: z.array(groupSchema),
});

export const groupCreateResponseSchema = groupSchema;

// ============================================
// User Schemas
// ============================================

export const authentikUserSchema = z.object({
  pk: z.number(),
  username: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  last_login: z.string().nullable().optional(),
  is_superuser: z.boolean(),
  groups: z.array(z.string().uuid()),
  groups_obj: z.array(groupSchema).optional(),
  email: z.string(),
  avatar: z.string(),
  attributes: z.record(z.string(), z.unknown()),
  uid: z.string(),
  path: z.string(),
  type: z.enum(['internal', 'external', 'service_account', 'internal_service_account']),
});

export const authentikUserListResponseSchema = z.object({
  pagination: paginationSchema,
  results: z.array(authentikUserSchema),
});

// ============================================
// Root Config Schema (for health check)
// ============================================

export const rootConfigSchema = z
  .object({
    version: z.string().optional(),
    version_current: z.string().optional(),
    build_hash: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  })
  .passthrough(); // Allow additional fields

// ============================================
// Error Schema
// ============================================

export const apiErrorSchema = z
  .object({
    detail: z.string().optional(),
    code: z.string().optional(),
    non_field_errors: z.array(z.string()).optional(),
  })
  .passthrough();

// Type exports
export type FlowListResponse = z.infer<typeof flowListResponseSchema>;
export type ScopeMappingListResponse = z.infer<typeof scopeMappingListResponseSchema>;
export type OAuth2ProviderListResponse = z.infer<typeof oauth2ProviderListResponseSchema>;
export type ApplicationListResponse = z.infer<typeof applicationListResponseSchema>;
export type GroupListResponse = z.infer<typeof groupListResponseSchema>;
export type AuthentikUserListResponse = z.infer<typeof authentikUserListResponseSchema>;
