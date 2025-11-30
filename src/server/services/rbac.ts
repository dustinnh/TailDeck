/**
 * RBAC Service
 *
 * Provides role-based access control utilities for TailDeck.
 * Supports both OIDC-synced roles and database override roles.
 */

import 'server-only';

import { prisma } from '@/lib/db';

// Role names matching database
export type RoleName = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'USER';

// Role hierarchy for comparison (higher = more permissions)
export const ROLE_HIERARCHY: Record<RoleName, number> = {
  OWNER: 100,
  ADMIN: 80,
  OPERATOR: 60,
  AUDITOR: 40,
  USER: 20,
};

// All roles in order of hierarchy
export const ALL_ROLES: RoleName[] = ['OWNER', 'ADMIN', 'OPERATOR', 'AUDITOR', 'USER'];

/**
 * Check if a user has at least one of the required roles
 */
export async function hasRole(userId: string, requiredRoles: RoleName[]): Promise<boolean> {
  const userRoles = await getUserRoles(userId);
  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.permissions) {
      if (
        rolePermission.permission.resource === resource &&
        rolePermission.permission.action === action
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get all role names for a user
 * Returns roles ordered by hierarchy (highest first)
 */
export async function getUserRoles(userId: string): Promise<RoleName[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
    orderBy: { createdAt: 'asc' },
  });

  const roleNames = userRoles.map((ur) => ur.role.name as RoleName);

  // Sort by hierarchy (highest first)
  return roleNames.sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);
}

/**
 * Get the highest role for a user
 */
export async function getHighestRole(userId: string): Promise<RoleName | null> {
  const roles = await getUserRoles(userId);
  return roles[0] || null;
}

/**
 * Check if a role meets minimum required level
 */
export function meetsMinimumRole(userRole: RoleName, minimumRole: RoleName): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Assign a role to a user
 */
export async function assignRole(
  userId: string,
  roleName: RoleName,
  source: 'OIDC' | 'DATABASE' = 'DATABASE'
): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
    update: { source },
    create: {
      userId,
      roleId: role.id,
      source,
    },
  });
}

/**
 * Remove a role from a user
 */
export async function removeRole(userId: string, roleName: RoleName): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  await prisma.userRole.deleteMany({
    where: {
      userId,
      roleId: role.id,
    },
  });
}

/**
 * Remove all OIDC-synced roles for a user
 * Used before re-syncing from OIDC groups
 */
export async function removeOIDCRoles(userId: string): Promise<void> {
  await prisma.userRole.deleteMany({
    where: {
      userId,
      source: 'OIDC',
    },
  });
}

/**
 * Get roles that can be assigned by a given role
 * OWNER can assign all roles
 * ADMIN can assign all except OWNER
 */
export function getAssignableRoles(assignerRole: RoleName): RoleName[] {
  if (assignerRole === 'OWNER') {
    return ALL_ROLES;
  }
  if (assignerRole === 'ADMIN') {
    return ALL_ROLES.filter((r) => r !== 'OWNER');
  }
  return [];
}

/**
 * Check if a user can assign a specific role
 */
export function canAssignRole(assignerRole: RoleName, targetRole: RoleName): boolean {
  return getAssignableRoles(assignerRole).includes(targetRole);
}
