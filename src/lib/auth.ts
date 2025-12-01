import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';

import { getUserRoles, type RoleName } from '@/server/services/rbac';
import { ensureUserAndSyncRoles, ensureOwnerExists } from '@/server/services/user-sync';

import { authConfig } from './auth.config';
import { prisma } from './db';

/**
 * Auth.js v5 configuration with Authentik OIDC provider
 *
 * This file contains server-only code and should NOT be imported
 * in middleware or client components.
 *
 * Features:
 * - OIDC authentication with Authentik
 * - Group-to-role sync on login
 * - Roles embedded in JWT for performant authorization
 */

/**
 * Get environment variables with fallbacks for type safety
 * The actual validation happens in env.ts at startup
 */
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

/**
 * Authentik OIDC profile type
 */
interface AuthentikProfile {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
  groups?: string[];
}

/**
 * Authentik OIDC Provider configuration
 * Requests groups scope for role synchronization
 */
const authentikProvider = {
  id: 'authentik',
  name: 'Authentik',
  type: 'oidc' as const,
  issuer: getEnvVar('AUTH_AUTHENTIK_ISSUER'),
  clientId: getEnvVar('AUTH_AUTHENTIK_ID'),
  clientSecret: getEnvVar('AUTH_AUTHENTIK_SECRET'),
  authorization: {
    params: {
      // Request groups scope for role mapping
      scope: 'openid profile email groups',
    },
  },
  profile(profile: AuthentikProfile) {
    // Note: groups are NOT included here as they're not part of the User model
    // Groups are accessed via profile.groups in the JWT callback for role sync
    return {
      id: profile.sub,
      name: profile.name ?? profile.preferred_username,
      email: profile.email,
      image: profile.picture,
    };
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // Use Prisma adapter for database sessions
  adapter: PrismaAdapter(prisma),

  // Add the Authentik provider
  providers: [authentikProvider],

  // Session configuration
  session: {
    // Use JWT strategy for better performance
    strategy: 'jwt',
    // Maximum session age: 30 days
    maxAge: 30 * 24 * 60 * 60,
    // Update session every 24 hours
    updateAge: 24 * 60 * 60,
  },

  // Extended callbacks
  callbacks: {
    ...authConfig.callbacks,

    /**
     * JWT callback - called when JWT is created or updated
     *
     * On initial sign-in:
     * 1. Syncs OIDC groups to database roles
     * 2. Ensures first user becomes OWNER
     * 3. Embeds roles in JWT for performant auth checks
     */
    async jwt({ token, user, account, profile }) {
      // Initial sign-in: sync roles and add to token
      if (account && user) {
        token.id = user.id;

        // Store token expiry for potential refresh logic
        if (account.expires_at) {
          token.accessTokenExpires = account.expires_at * 1000;
        }

        // Sync OIDC groups to roles
        const groups = (profile as AuthentikProfile)?.groups ?? [];
        try {
          await ensureUserAndSyncRoles({
            oidcSubject: account.providerAccountId,
            email: user.email,
            name: user.name,
            groups,
          });

          // Check if this should be the first OWNER
          await ensureOwnerExists(user.id);

          // Get roles and embed in token
          const roles = await getUserRoles(user.id);
          token.roles = roles;
        } catch (error) {
          console.error('Failed to sync user roles:', error);
          // Default to USER role if sync fails
          token.roles = ['USER' as RoleName];
        }
      }

      // Refresh roles on token update (every 24 hours)
      // This ensures role changes take effect without re-login
      if (!account && token.id) {
        try {
          const roles = await getUserRoles(token.id as string);
          token.roles = roles;
        } catch {
          // Keep existing roles if refresh fails
        }
      }

      return token;
    },

    /**
     * Session callback - expose user ID and roles to client
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.roles = (token.roles as RoleName[]) ?? [];
      }
      return session;
    },
  },

  // Trust proxy headers (needed for containerized deployments)
  trustHost: true,

  // Debug mode only in development
  debug: process.env.NODE_ENV === 'development',
});
