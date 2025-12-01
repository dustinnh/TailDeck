import { z } from 'zod';

/**
 * Server-side environment variables schema
 * These are NEVER exposed to the browser
 * IMPORTANT: Do NOT use NEXT_PUBLIC_ prefix for any secret
 */
const serverEnvSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Auth.js
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters. Generate with: openssl rand -base64 32'),
  AUTH_URL: z.string().url('AUTH_URL must be a valid URL'),

  // Authentik OIDC
  AUTH_AUTHENTIK_ID: z.string().min(1, 'AUTH_AUTHENTIK_ID is required'),
  AUTH_AUTHENTIK_SECRET: z.string().min(1, 'AUTH_AUTHENTIK_SECRET is required'),
  AUTH_AUTHENTIK_ISSUER: z.string().url('AUTH_AUTHENTIK_ISSUER must be a valid URL'),

  // Headscale (SERVER-ONLY - never expose to browser)
  HEADSCALE_URL: z.string().url('HEADSCALE_URL must be a valid URL'),
  HEADSCALE_API_KEY: z.string().min(1, 'HEADSCALE_API_KEY is required'),

  // Optional: Headscale metrics endpoint (for future observability features)
  HEADSCALE_METRICS_URL: z.string().url().optional(),

  // Optional: Flow Log Integration (Loki)
  LOKI_URL: z.string().url().optional(),
  LOKI_TENANT_ID: z.string().optional(),
  LOKI_USERNAME: z.string().optional(),
  LOKI_PASSWORD: z.string().optional(),
  LOKI_TIMEOUT: z.coerce.number().int().min(1000).max(120000).optional(),

  // Optional: Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

/**
 * Client-side environment variables schema
 * These are safe to expose to the browser via NEXT_PUBLIC_ prefix
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// Type exports for use throughout the application
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates server environment variables
 * Called at server startup - fails fast on missing/invalid config
 */
function validateServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid server environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid server environment configuration. Check the errors above.');
  }

  return result.data;
}

/**
 * Validates client environment variables
 */
function validateClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    console.error('❌ Invalid client environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid client environment configuration.');
  }

  return result.data;
}

// Validate and export server environment (only available server-side)
// This will throw at startup if configuration is invalid
export const serverEnv = validateServerEnv();

// Validate and export client environment (safe for browser)
export const clientEnv = validateClientEnv();

/**
 * Helper to check if we're running on the server
 */
export const isServer = typeof window === 'undefined';
