/**
 * Audit Logging Service
 *
 * Provides comprehensive audit logging for all mutations in TailDeck.
 * Every action that modifies state is logged with actor, resource, and before/after values.
 */

import 'server-only';

import { prisma } from '@/lib/db';

/**
 * All auditable actions in TailDeck
 */
export type AuditAction =
  // Node actions
  | 'CREATE_NODE'
  | 'DELETE_NODE'
  | 'RENAME_NODE'
  | 'UPDATE_TAGS'
  | 'EXPIRE_NODE'
  | 'MOVE_NODE'
  // Bulk node actions
  | 'BULK_DELETE'
  | 'BULK_EXPIRE'
  | 'BULK_MOVE'
  | 'BULK_TAGS'
  // Route actions
  | 'ENABLE_ROUTE'
  | 'DISABLE_ROUTE'
  | 'DELETE_ROUTE'
  // ACL actions
  | 'UPDATE_ACL'
  // PreAuth Key actions
  | 'CREATE_KEY'
  | 'EXPIRE_KEY'
  | 'DELETE_KEY'
  // API Key actions
  | 'CREATE_API_KEY'
  | 'DELETE_API_KEY'
  | 'EXPIRE_API_KEY'
  // DNS actions
  | 'UPDATE_DNS'
  // User actions
  | 'CREATE_USER'
  | 'DELETE_USER'
  | 'RENAME_USER'
  // Role actions
  | 'ASSIGN_ROLE'
  | 'REMOVE_ROLE'
  // Settings actions
  | 'UPDATE_SETTING'
  // Login/logout actions
  | 'USER_LOGIN'
  | 'USER_LOGOUT';

/**
 * Resource types that can be audited
 */
export type AuditResourceType =
  | 'NODE'
  | 'ROUTE'
  | 'ACL'
  | 'KEY'
  | 'API_KEY'
  | 'DNS'
  | 'USER'
  | 'ROLE'
  | 'SETTING';

/**
 * Parameters for creating an audit log entry
 */
export interface AuditLogEntry {
  /** User ID of the actor (null for system actions) */
  actorUserId: string | null;
  /** Email of the actor (for display purposes) */
  actorEmail: string | null;
  /** IP address of the actor */
  actorIp: string | null;
  /** The action performed */
  action: AuditAction;
  /** Type of resource affected */
  resourceType: AuditResourceType;
  /** ID of the specific resource (optional) */
  resourceId?: string;
  /** Additional context about the action */
  metadata?: Record<string, unknown>;
  /** State before the change (for updates/deletes) */
  oldValue?: unknown;
  /** State after the change (for creates/updates) */
  newValue?: unknown;
}

/**
 * Log an audit entry
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        actorEmail: entry.actorEmail,
        actorIp: entry.actorIp,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata as object | undefined,
        oldValue: entry.oldValue as object | undefined,
        newValue: entry.newValue as object | undefined,
      },
    });
  } catch (error) {
    // Log to console but don't fail the operation
    // Audit logging should never break the main flow
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Query parameters for fetching audit logs
 */
export interface AuditLogQueryParams {
  /** Filter by actor user ID */
  actorUserId?: string;
  /** Filter by action type */
  action?: AuditAction;
  /** Filter by resource type */
  resourceType?: AuditResourceType;
  /** Filter by resource ID */
  resourceId?: string;
  /** Filter by start date */
  startDate?: Date;
  /** Filter by end date */
  endDate?: Date;
  /** Number of records to return */
  limit?: number;
  /** Number of records to skip (for pagination) */
  offset?: number;
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(params: AuditLogQueryParams) {
  const {
    actorUserId,
    action,
    resourceType,
    resourceId,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = params;

  const where: {
    actorUserId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    timestamp?: { gte?: Date; lte?: Date };
  } = {};

  if (actorUserId) where.actorUserId = actorUserId;
  if (action) where.action = action;
  if (resourceType) where.resourceType = resourceType;
  if (resourceId) where.resourceId = resourceId;

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    hasMore: offset + logs.length < total,
  };
}

/**
 * Get recent audit logs for dashboard display
 */
export async function getRecentAuditLogs(limit: number = 5) {
  return prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: AuditResourceType,
  resourceId: string,
  limit: number = 20
) {
  return prisma.auditLog.findMany({
    where: {
      resourceType,
      resourceId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

/**
 * Helper to extract client IP from request headers
 */
export function getClientIp(headers: Headers): string | null {
  // Check common headers in order of preference
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first
    const firstIp = forwardedFor.split(',')[0];
    return firstIp ? firstIp.trim() : null;
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return null;
}

/**
 * Human-readable descriptions for audit actions
 */
export const AUDIT_ACTION_LABELS: { [K in AuditAction]: string } = {
  CREATE_NODE: 'Created node',
  DELETE_NODE: 'Deleted node',
  RENAME_NODE: 'Renamed node',
  UPDATE_TAGS: 'Updated tags',
  EXPIRE_NODE: 'Expired node',
  MOVE_NODE: 'Moved node to user',
  BULK_DELETE: 'Bulk deleted nodes',
  BULK_EXPIRE: 'Bulk expired nodes',
  BULK_MOVE: 'Bulk moved nodes',
  BULK_TAGS: 'Bulk updated tags',
  ENABLE_ROUTE: 'Enabled route',
  DISABLE_ROUTE: 'Disabled route',
  DELETE_ROUTE: 'Deleted route',
  UPDATE_ACL: 'Updated ACL policy',
  CREATE_KEY: 'Created auth key',
  EXPIRE_KEY: 'Expired auth key',
  DELETE_KEY: 'Deleted auth key',
  CREATE_API_KEY: 'Created API key',
  DELETE_API_KEY: 'Deleted API key',
  EXPIRE_API_KEY: 'Expired API key',
  UPDATE_DNS: 'Updated DNS configuration',
  CREATE_USER: 'Created user',
  DELETE_USER: 'Deleted user',
  RENAME_USER: 'Renamed user',
  ASSIGN_ROLE: 'Assigned role',
  REMOVE_ROLE: 'Removed role',
  UPDATE_SETTING: 'Updated setting',
  USER_LOGIN: 'User logged in',
  USER_LOGOUT: 'User logged out',
};
