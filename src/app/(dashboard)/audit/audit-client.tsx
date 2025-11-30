'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/api/query-keys';

type RoleName = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'USER';

const ROLE_HIERARCHY: Record<RoleName, number> = {
  OWNER: 100,
  ADMIN: 80,
  OPERATOR: 60,
  AUDITOR: 40,
  USER: 20,
};

function hasMinRole(userRoles: RoleName[], minRole: RoleName): boolean {
  const minLevel = ROLE_HIERARCHY[minRole];
  return userRoles.some((role) => ROLE_HIERARCHY[role] >= minLevel);
}

interface AuditLog {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorIp: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_NODE: 'Created machine',
  DELETE_NODE: 'Deleted machine',
  RENAME_NODE: 'Renamed machine',
  UPDATE_TAGS: 'Updated tags',
  EXPIRE_NODE: 'Expired machine',
  MOVE_NODE: 'Moved machine',
  ENABLE_ROUTE: 'Enabled route',
  DISABLE_ROUTE: 'Disabled route',
  DELETE_ROUTE: 'Deleted route',
  UPDATE_ACL: 'Updated ACL policy',
  CREATE_KEY: 'Created auth key',
  EXPIRE_KEY: 'Expired auth key',
  DELETE_KEY: 'Deleted auth key',
  CREATE_USER: 'Created user',
  DELETE_USER: 'Deleted user',
  RENAME_USER: 'Renamed user',
  ASSIGN_ROLE: 'Assigned role',
  REMOVE_ROLE: 'Removed role',
  UPDATE_SETTING: 'Updated setting',
  USER_LOGIN: 'User logged in',
  USER_LOGOUT: 'User logged out',
};

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE_NODE: 'default',
  DELETE_NODE: 'destructive',
  RENAME_NODE: 'secondary',
  UPDATE_TAGS: 'secondary',
  EXPIRE_NODE: 'destructive',
  MOVE_NODE: 'secondary',
  ENABLE_ROUTE: 'default',
  DISABLE_ROUTE: 'secondary',
  DELETE_ROUTE: 'destructive',
  UPDATE_ACL: 'default',
  CREATE_KEY: 'default',
  EXPIRE_KEY: 'destructive',
  DELETE_KEY: 'destructive',
  CREATE_USER: 'default',
  DELETE_USER: 'destructive',
  RENAME_USER: 'secondary',
  ASSIGN_ROLE: 'default',
  REMOVE_ROLE: 'destructive',
  UPDATE_SETTING: 'secondary',
  USER_LOGIN: 'outline',
  USER_LOGOUT: 'outline',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  NODE: 'Machine',
  ROUTE: 'Route',
  ACL: 'ACL Policy',
  KEY: 'Auth Key',
  USER: 'User',
  ROLE: 'Role',
  SETTING: 'Setting',
};

const PAGE_SIZE = 25;

async function fetchAuditLogs(params: {
  action?: string;
  resourceType?: string;
  limit: number;
  offset: number;
}): Promise<AuditResponse> {
  const url = new URL('/api/audit', window.location.origin);
  if (params.action && params.action !== 'all') {
    url.searchParams.set('action', params.action);
  }
  if (params.resourceType && params.resourceType !== 'all') {
    url.searchParams.set('resourceType', params.resourceType);
  }
  url.searchParams.set('limit', params.limit.toString());
  url.searchParams.set('offset', params.offset.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch audit logs');
  }
  return res.json();
}

export function AuditClient() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const canView = hasMinRole(userRoles, 'AUDITOR');

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.auditLogs.list({
      action: actionFilter !== 'all' ? actionFilter : undefined,
      resourceType: resourceFilter !== 'all' ? resourceFilter : undefined,
    }),
    queryFn: () =>
      fetchAuditLogs({
        action: actionFilter,
        resourceType: resourceFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    enabled: canView,
  });

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You need AUDITOR role or higher to view audit logs.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return <AuditClientSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Audit Logs</CardTitle>
          <CardDescription>Failed to fetch audit log data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>{total} total entries</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(ACTION_LABELS).map(([action, label]) => (
                  <SelectItem key={action} value={action}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {Object.entries(RESOURCE_TYPE_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No audit logs match your filters
            </p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <Tooltip>
                            <TooltipTrigger>
                              {formatDistanceToNow(new Date(log.timestamp), {
                                addSuffix: true,
                              })}
                            </TooltipTrigger>
                            <TooltipContent>
                              {format(new Date(log.timestamp), 'PPpp')}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_COLORS[log.action] || 'outline'}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm">
                              {RESOURCE_TYPE_LABELS[log.resourceType] || log.resourceType}
                            </span>
                            {log.resourceId && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({log.resourceId})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {log.user?.name || log.actorEmail || 'System'}
                            </span>
                            {log.actorIp && (
                              <span className="text-xs text-muted-foreground">{log.actorIp}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="cursor-help">
                                  +details
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <pre className="max-w-xs overflow-auto text-xs">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, total)} of{' '}
                    {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!data?.hasMore}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function AuditClientSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-4">
          <div className="h-10 w-[180px] animate-pulse rounded bg-muted" />
          <div className="h-10 w-[180px] animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
