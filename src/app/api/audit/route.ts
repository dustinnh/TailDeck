/**
 * Audit Logs API Route
 *
 * Provides access to audit logs with filtering and pagination.
 * Security: Requires AUDITOR role or higher.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { withRoles } from '@/server/middleware/require-role';
import { queryAuditLogs, type AuditAction, type AuditResourceType } from '@/server/services/audit';

const VALID_ACTIONS: AuditAction[] = [
  'CREATE_NODE',
  'DELETE_NODE',
  'RENAME_NODE',
  'UPDATE_TAGS',
  'EXPIRE_NODE',
  'MOVE_NODE',
  'ENABLE_ROUTE',
  'DISABLE_ROUTE',
  'DELETE_ROUTE',
  'UPDATE_ACL',
  'CREATE_KEY',
  'EXPIRE_KEY',
  'DELETE_KEY',
  'CREATE_USER',
  'DELETE_USER',
  'RENAME_USER',
  'ASSIGN_ROLE',
  'REMOVE_ROLE',
  'UPDATE_SETTING',
  'USER_LOGIN',
  'USER_LOGOUT',
];

const VALID_RESOURCE_TYPES: AuditResourceType[] = [
  'NODE',
  'ROUTE',
  'ACL',
  'KEY',
  'USER',
  'ROLE',
  'SETTING',
];

/**
 * GET /api/audit
 *
 * Returns audit logs with optional filtering.
 * Query params: action, resourceType, resourceId, startDate, endDate, limit, offset
 */
export const GET = withRoles(
  ['AUDITOR', 'OPERATOR', 'ADMIN', 'OWNER'],
  async (req: NextRequest) => {
    const requestId = crypto.randomUUID();

    try {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      const resourceType = url.searchParams.get('resourceType');
      const resourceId = url.searchParams.get('resourceId') ?? undefined;
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
      const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

      // Validate action if provided
      if (action && !VALID_ACTIONS.includes(action as AuditAction)) {
        return NextResponse.json(
          { error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(', ')}` },
          { status: 400, headers: { 'X-Request-ID': requestId } }
        );
      }

      // Validate resource type if provided
      if (resourceType && !VALID_RESOURCE_TYPES.includes(resourceType as AuditResourceType)) {
        return NextResponse.json(
          { error: `Invalid resourceType. Valid types: ${VALID_RESOURCE_TYPES.join(', ')}` },
          { status: 400, headers: { 'X-Request-ID': requestId } }
        );
      }

      const result = await queryAuditLogs({
        action: action as AuditAction | undefined,
        resourceType: resourceType as AuditResourceType | undefined,
        resourceId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit,
        offset,
      });

      return NextResponse.json(result, {
        headers: { 'X-Request-ID': requestId },
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  }
);
