/**
 * User Sync Service
 *
 * Handles synchronization of OIDC groups to TailDeck roles.
 * Called during user login to update role assignments.
 */

import 'server-only';

import { prisma } from '@/lib/db';

import { assignRole, removeOIDCRoles, type RoleName } from './rbac';

/**
 * Mapping from OIDC group names to TailDeck roles
 * Configure these to match your Authentik group names
 */
export const OIDC_GROUP_ROLE_MAP: Record<string, RoleName> = {
  // Authentik groups -> TailDeck roles
  'TailDeck Admins': 'ADMIN',
  'TailDeck Operators': 'OPERATOR',
  'TailDeck Auditors': 'AUDITOR',
  'TailDeck Users': 'USER',
  // Legacy/alternative group names
  'taildeck-admins': 'ADMIN',
  'taildeck-operators': 'OPERATOR',
  'taildeck-auditors': 'AUDITOR',
  'taildeck-users': 'USER',
};

/**
 * Sync OIDC groups to TailDeck roles
 *
 * This function:
 * 1. Removes all existing OIDC-synced roles
 * 2. Maps OIDC groups to TailDeck roles
 * 3. Assigns new roles from OIDC groups
 *
 * Database-assigned roles are preserved (not affected by sync)
 *
 * @param userId - The TailDeck user ID
 * @param oidcGroups - Array of group names from OIDC provider
 */
export async function syncUserRolesFromOIDC(userId: string, oidcGroups: string[]): Promise<void> {
  // Remove existing OIDC-synced roles
  await removeOIDCRoles(userId);

  // Map OIDC groups to roles
  const rolesToAssign = new Set<RoleName>();

  for (const group of oidcGroups) {
    const role = OIDC_GROUP_ROLE_MAP[group];
    if (role) {
      rolesToAssign.add(role);
    }
  }

  // Assign roles from OIDC groups
  for (const role of Array.from(rolesToAssign)) {
    await assignRole(userId, role, 'OIDC');
  }
}

/**
 * Ensure user exists in database and sync roles
 *
 * Called during authentication callback to ensure
 * the user record exists and roles are synced.
 *
 * @param oidcSubject - The OIDC subject (sub claim)
 * @param email - User's email
 * @param name - User's display name
 * @param groups - OIDC groups
 * @returns The user ID
 */
export async function ensureUserAndSyncRoles(params: {
  oidcSubject: string;
  email?: string | null;
  name?: string | null;
  groups: string[];
}): Promise<string> {
  const { oidcSubject, email, name, groups } = params;

  // Find or create user
  // Auth.js should handle user creation, but we check to be safe
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: email ?? undefined },
        {
          accounts: {
            some: {
              providerAccountId: oidcSubject,
            },
          },
        },
      ],
    },
  });

  if (!user) {
    // This shouldn't normally happen as Auth.js creates users
    // But handle it gracefully
    user = await prisma.user.create({
      data: {
        email,
        name,
      },
    });
  }

  // Sync roles from OIDC groups
  await syncUserRolesFromOIDC(user.id, groups);

  return user.id;
}

/**
 * Get effective roles for a user
 *
 * Returns all roles (both OIDC-synced and database-assigned)
 * Database roles take precedence for display purposes
 *
 * @param userId - The TailDeck user ID
 */
export async function getEffectiveRoles(userId: string): Promise<
  Array<{
    name: RoleName;
    source: 'OIDC' | 'DATABASE';
  }>
> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });

  return userRoles.map((ur) => ({
    name: ur.role.name as RoleName,
    source: ur.source as 'OIDC' | 'DATABASE',
  }));
}

/**
 * Check if user has any database-assigned roles
 * (roles that override OIDC-synced roles)
 */
export async function hasDatabaseRoles(userId: string): Promise<boolean> {
  const count = await prisma.userRole.count({
    where: {
      userId,
      source: 'DATABASE',
    },
  });
  return count > 0;
}

/**
 * Assign the first user as OWNER if no OWNER exists
 * Used during initial setup
 */
export async function ensureOwnerExists(userId: string): Promise<boolean> {
  const ownerRole = await prisma.role.findUnique({
    where: { name: 'OWNER' },
  });

  if (!ownerRole) {
    throw new Error('OWNER role not found - run db:seed');
  }

  // Check if any OWNER exists
  const existingOwner = await prisma.userRole.findFirst({
    where: { roleId: ownerRole.id },
  });

  if (!existingOwner) {
    // Assign OWNER to this user
    await assignRole(userId, 'OWNER', 'DATABASE');
    return true;
  }

  return false;
}
