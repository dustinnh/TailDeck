/**
 * User Roles API Route
 *
 * Manage database role overrides for users.
 * Security: Requires ADMIN role or higher.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { withRoles } from '@/server/middleware/require-role';
import { logAudit, getClientIp } from '@/server/services/audit';

/**
 * POST /api/users/roles
 *
 * Assign a database role to a user.
 */
export const POST = withRoles(['ADMIN', 'OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();

  try {
    const body = await req.json();
    const { userId, roleName } = body as { userId: string; roleName: string };

    if (!userId || !roleName) {
      return NextResponse.json(
        { error: 'userId and roleName are required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Prevent assigning OWNER role (should only be auto-assigned to first user)
    if (roleName === 'OWNER' && !ctx.user.roles?.includes('OWNER')) {
      return NextResponse.json(
        { error: 'Only OWNER can assign OWNER role' },
        { status: 403, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Check if role assignment already exists
    const existingAssignment = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'User already has this role' },
        { status: 409, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Create the role assignment
    await prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        source: 'DATABASE',
      },
    });

    // Log audit event
    await logAudit({
      action: 'ASSIGN_ROLE',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'ROLE',
      resourceId: roleName,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user.email,
        roleName,
      },
    });

    return NextResponse.json({ success: true }, { headers: { 'X-Request-ID': requestId } });
  } catch (error) {
    console.error('Error assigning role:', error);
    return NextResponse.json(
      { error: 'Failed to assign role' },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    );
  }
});

/**
 * DELETE /api/users/roles
 *
 * Remove a database role from a user.
 */
export const DELETE = withRoles(['ADMIN', 'OWNER'], async (req: NextRequest, ctx) => {
  const requestId = crypto.randomUUID();

  try {
    const body = await req.json();
    const { userId, roleName } = body as { userId: string; roleName: string };

    if (!userId || !roleName) {
      return NextResponse.json(
        { error: 'userId and roleName are required' },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Find the role assignment (only DATABASE source can be removed)
    const assignment = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        source: 'DATABASE',
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Database role assignment not found (OIDC roles cannot be removed here)' },
        { status: 404, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Get user for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Delete the role assignment
    await prisma.userRole.delete({
      where: { id: assignment.id },
    });

    // Log audit event
    await logAudit({
      action: 'REMOVE_ROLE',
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      actorIp: getClientIp(req.headers),
      resourceType: 'ROLE',
      resourceId: roleName,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user?.email,
        roleName,
      },
    });

    return NextResponse.json({ success: true }, { headers: { 'X-Request-ID': requestId } });
  } catch (error) {
    console.error('Error removing role:', error);
    return NextResponse.json(
      { error: 'Failed to remove role' },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    );
  }
});
