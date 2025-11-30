/**
 * RBAC Middleware for API Routes
 *
 * Provides role-based access control for Next.js API routes.
 * Wraps route handlers with authentication and authorization checks.
 */

import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import type { RoleName } from '@/server/services/rbac';
import { ROLE_HIERARCHY } from '@/server/services/rbac';

/**
 * Context passed to route handlers
 */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * Authenticated route context with user info
 */
export interface AuthenticatedContext extends RouteContext {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    roles: RoleName[];
  };
}

/**
 * Route handler type
 */
export type RouteHandler = (
  req: NextRequest,
  context: AuthenticatedContext
) => Promise<NextResponse | Response>;

/**
 * Create a middleware that requires specific roles
 *
 * @param roles - Array of role names that can access this route
 * @param handler - The route handler to execute if authorized
 * @returns A wrapped handler that checks authentication and authorization
 *
 * @example
 * ```typescript
 * export const GET = withRoles(['USER', 'OPERATOR', 'ADMIN', 'OWNER'], async (req, ctx) => {
 *   // Handler logic here - ctx.user is guaranteed to exist
 *   return NextResponse.json({ data: ... });
 * });
 * ```
 */
export function withRoles(roles: RoleName[], handler: RouteHandler) {
  return async (req: NextRequest, context: RouteContext) => {
    // Get the session
    const session = await auth();

    // Check authentication
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user roles from session
    const userRoles = (session.user.roles ?? []) as RoleName[];

    // Check if user has any of the required roles
    const hasRequiredRole = roles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Insufficient permissions',
          required: roles,
        },
        { status: 403 }
      );
    }

    // Create authenticated context
    const authenticatedContext: AuthenticatedContext = {
      ...context,
      user: {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        roles: userRoles,
      },
    };

    // Execute the handler
    return handler(req, authenticatedContext);
  };
}

/**
 * Require minimum role level (using hierarchy)
 *
 * @param minimumRole - The minimum role required (inclusive)
 * @param handler - The route handler to execute if authorized
 *
 * @example
 * ```typescript
 * // Anyone with OPERATOR or higher (ADMIN, OWNER) can access
 * export const POST = withMinimumRole('OPERATOR', async (req, ctx) => {
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withMinimumRole(minimumRole: RoleName, handler: RouteHandler) {
  return async (req: NextRequest, context: RouteContext) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userRoles = (session.user.roles ?? []) as RoleName[];
    const minimumLevel = ROLE_HIERARCHY[minimumRole];

    // Check if user has any role at or above the minimum level
    const meetsRequirement = userRoles.some((role) => ROLE_HIERARCHY[role] >= minimumLevel);

    if (!meetsRequirement) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Insufficient permissions',
          requiredLevel: minimumRole,
        },
        { status: 403 }
      );
    }

    const authenticatedContext: AuthenticatedContext = {
      ...context,
      user: {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        roles: userRoles,
      },
    };

    return handler(req, authenticatedContext);
  };
}

/**
 * Get all roles at or above a given level
 */
export function getRolesAtOrAbove(role: RoleName): RoleName[] {
  const level = ROLE_HIERARCHY[role];
  return (Object.entries(ROLE_HIERARCHY) as [RoleName, number][])
    .filter(([, roleLevel]) => roleLevel >= level)
    .map(([roleName]) => roleName);
}

/**
 * Helper to check if user has a specific role
 */
export function hasRole(userRoles: RoleName[], role: RoleName): boolean {
  return userRoles.includes(role);
}

/**
 * Helper to check if user meets minimum role requirement
 */
export function meetsMinimumRole(userRoles: RoleName[], minimumRole: RoleName): boolean {
  const minimumLevel = ROLE_HIERARCHY[minimumRole];
  return userRoles.some((role) => ROLE_HIERARCHY[role] >= minimumLevel);
}
