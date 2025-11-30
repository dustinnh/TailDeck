/**
 * Database seed script for TailDeck RBAC
 *
 * Creates:
 * - 5 system roles (OWNER, ADMIN, OPERATOR, AUDITOR, USER)
 * - Granular permissions for each resource
 * - Role-permission mappings
 *
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Role definitions with descriptions
const ROLES = [
  {
    name: 'OWNER',
    description: 'Full access to everything including role management',
    isSystem: true,
  },
  {
    name: 'ADMIN',
    description: 'Manage configuration, users, ACLs, DNS - cannot assign OWNER role',
    isSystem: true,
  },
  {
    name: 'OPERATOR',
    description: 'Manage machines, routes, health checks - cannot change ACLs/DNS',
    isSystem: true,
  },
  {
    name: 'AUDITOR',
    description: 'Read-only access to all screens including audit log',
    isSystem: true,
  },
  {
    name: 'USER',
    description: 'User portal only - manage own devices and keys',
    isSystem: true,
  },
] as const;

// Permission definitions
// Format: resource:action
const PERMISSIONS = [
  // Node permissions
  { name: 'nodes:read', resource: 'nodes', action: 'read' },
  { name: 'nodes:write', resource: 'nodes', action: 'write' },
  { name: 'nodes:delete', resource: 'nodes', action: 'delete' },

  // Route permissions
  { name: 'routes:read', resource: 'routes', action: 'read' },
  { name: 'routes:write', resource: 'routes', action: 'write' },

  // ACL/Policy permissions
  { name: 'acl:read', resource: 'acl', action: 'read' },
  { name: 'acl:write', resource: 'acl', action: 'write' },

  // User management permissions (TailDeck users, not Headscale)
  { name: 'users:read', resource: 'users', action: 'read' },
  { name: 'users:write', resource: 'users', action: 'write' },
  { name: 'users:delete', resource: 'users', action: 'delete' },

  // PreAuth key permissions
  { name: 'keys:read', resource: 'keys', action: 'read' },
  { name: 'keys:write', resource: 'keys', action: 'write' },
  { name: 'keys:delete', resource: 'keys', action: 'delete' },

  // Audit log permissions
  { name: 'audit:read', resource: 'audit', action: 'read' },

  // Settings permissions
  { name: 'settings:read', resource: 'settings', action: 'read' },
  { name: 'settings:write', resource: 'settings', action: 'write' },

  // Role management permissions
  { name: 'roles:read', resource: 'roles', action: 'read' },
  { name: 'roles:write', resource: 'roles', action: 'write' },
] as const;

// Role-permission mappings
// Each role gets specific permissions
const ROLE_PERMISSIONS: Record<string, string[]> = {
  // OWNER: Everything
  OWNER: [
    'nodes:read',
    'nodes:write',
    'nodes:delete',
    'routes:read',
    'routes:write',
    'acl:read',
    'acl:write',
    'users:read',
    'users:write',
    'users:delete',
    'keys:read',
    'keys:write',
    'keys:delete',
    'audit:read',
    'settings:read',
    'settings:write',
    'roles:read',
    'roles:write',
  ],

  // ADMIN: Everything except role management
  ADMIN: [
    'nodes:read',
    'nodes:write',
    'nodes:delete',
    'routes:read',
    'routes:write',
    'acl:read',
    'acl:write',
    'users:read',
    'users:write',
    'users:delete',
    'keys:read',
    'keys:write',
    'keys:delete',
    'audit:read',
    'settings:read',
    'settings:write',
    'roles:read',
  ],

  // OPERATOR: Node and route management
  OPERATOR: [
    'nodes:read',
    'nodes:write',
    'routes:read',
    'routes:write',
    'users:read',
    'keys:read',
    'keys:write',
    'keys:delete',
    'audit:read',
    'settings:read',
  ],

  // AUDITOR: Read-only everything
  AUDITOR: [
    'nodes:read',
    'routes:read',
    'acl:read',
    'users:read',
    'keys:read',
    'audit:read',
    'settings:read',
    'roles:read',
  ],

  // USER: Own devices only (filtered at API level)
  USER: ['nodes:read', 'keys:read', 'keys:write'],
};

async function main() {
  console.log('Seeding TailDeck database...\n');

  // Create roles
  console.log('Creating roles...');
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
    console.log(`  - ${role.name}`);
  }

  // Create permissions
  console.log('\nCreating permissions...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
    console.log(`  - ${permission.name}`);
  }

  // Create role-permission mappings
  console.log('\nCreating role-permission mappings...');
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.error(`  ! Role ${roleName} not found`);
      continue;
    }

    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({
        where: { name: permissionName },
      });
      if (!permission) {
        console.error(`  ! Permission ${permissionName} not found`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
    console.log(`  - ${roleName}: ${permissionNames.length} permissions`);
  }

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
