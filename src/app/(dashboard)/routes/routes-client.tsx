'use client';

import { X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRoutes, useToggleRoute, isExitNodeRoute, type Route } from '@/lib/api/hooks/use-routes';

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

export function RoutesClient() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const canToggle = hasMinRole(userRoles, 'OPERATOR');

  const { data: routes, isLoading, error, refetch } = useRoutes();
  const toggleRoute = useToggleRoute();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [nodeFilter, setNodeFilter] = useState<string>('all');

  const hasActiveFilters = search !== '' || statusFilter !== 'all' || nodeFilter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setNodeFilter('all');
  };

  if (isLoading) {
    return <RoutesClientSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Routes</CardTitle>
          <CardDescription>Failed to connect to Headscale</CardDescription>
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

  if (!routes || routes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Routes Found</CardTitle>
          <CardDescription>
            There are no advertised routes in your Headscale network yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Routes are advertised by Tailscale clients. Configure a client to advertise subnet
            routes or act as an exit node.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Separate exit nodes from subnet routes
  const exitNodeRoutes = routes.filter(isExitNodeRoute);
  const subnetRoutes = routes.filter((r) => !isExitNodeRoute(r));

  // Get unique nodes for filter
  const nodes = Array.from(new Set(routes.map((r) => r.node.givenName || r.node.name))).sort();

  // Filter routes
  const filterRoutes = (routeList: Route[]) =>
    routeList.filter((route) => {
      const nodeName = route.node.givenName || route.node.name;
      const matchesSearch =
        search === '' ||
        nodeName.toLowerCase().includes(search.toLowerCase()) ||
        route.prefix.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'enabled' && route.enabled) ||
        (statusFilter === 'disabled' && !route.enabled);

      const matchesNode = nodeFilter === 'all' || nodeName === nodeFilter;

      return matchesSearch && matchesStatus && matchesNode;
    });

  const filteredExitNodes = filterRoutes(exitNodeRoutes);
  const filteredSubnetRoutes = filterRoutes(subnetRoutes);

  // Group exit nodes by node (a node might advertise both IPv4 and IPv6 exit routes)
  const exitNodesByMachine = filteredExitNodes.reduce(
    (acc, route) => {
      const nodeId = route.node.id;
      if (!acc[nodeId]) {
        acc[nodeId] = {
          node: route.node,
          ipv4Route: null as Route | null,
          ipv6Route: null as Route | null,
        };
      }
      if (route.prefix === '0.0.0.0/0') {
        acc[nodeId].ipv4Route = route;
      } else if (route.prefix === '::/0') {
        acc[nodeId].ipv6Route = route;
      }
      return acc;
    },
    {} as Record<string, { node: Route['node']; ipv4Route: Route | null; ipv6Route: Route | null }>
  );

  const handleToggle = async (route: Route, enabled: boolean) => {
    try {
      await toggleRoute.mutateAsync({ id: route.id, enabled });
    } catch {
      // Error handled by mutation
    }
  };

  const enabledExitCount = Object.values(exitNodesByMachine).filter(
    (e) => e.ipv4Route?.enabled || e.ipv6Route?.enabled
  ).length;
  const enabledSubnetCount = subnetRoutes.filter((r) => r.enabled).length;

  return (
    <TooltipProvider>
      <Tabs defaultValue="exit-nodes" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="exit-nodes">
              Exit Nodes ({Object.keys(exitNodesByMachine).length})
            </TabsTrigger>
            <TabsTrigger value="subnets">Subnet Routes ({subnetRoutes.length})</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <Input
              placeholder="Search by node name or prefix..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={nodeFilter} onValueChange={setNodeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Node" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nodes</SelectItem>
              {nodes.map((node) => (
                <SelectItem key={node} value={node}>
                  {node}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Exit Nodes Tab */}
        <TabsContent value="exit-nodes">
          <Card>
            <CardHeader>
              <CardTitle>Exit Nodes</CardTitle>
              <CardDescription>
                {Object.keys(exitNodesByMachine).length} exit node
                {Object.keys(exitNodesByMachine).length !== 1 ? 's' : ''} ({enabledExitCount}{' '}
                enabled)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(exitNodesByMachine).length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No exit nodes match your filters
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Node</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>IPv4 (0.0.0.0/0)</TableHead>
                        <TableHead>IPv6 (::/0)</TableHead>
                        {canToggle && <TableHead className="w-[100px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(exitNodesByMachine).map(({ node, ipv4Route, ipv6Route }) => {
                        const isEnabled = ipv4Route?.enabled || ipv6Route?.enabled;
                        return (
                          <TableRow key={node.id}>
                            <TableCell className="font-medium">
                              <div>
                                <div>{node.givenName || node.name}</div>
                                <code className="text-xs text-muted-foreground">
                                  {node.ipAddresses[0]}
                                </code>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={isEnabled ? 'default' : 'secondary'}>
                                {isEnabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {ipv4Route ? (
                                <Badge
                                  variant={ipv4Route.enabled ? 'default' : 'outline'}
                                  className="text-xs"
                                >
                                  {ipv4Route.enabled ? 'Active' : 'Inactive'}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {ipv6Route ? (
                                <Badge
                                  variant={ipv6Route.enabled ? 'default' : 'outline'}
                                  className="text-xs"
                                >
                                  {ipv6Route.enabled ? 'Active' : 'Inactive'}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            {canToggle && (
                              <TableCell>
                                <div className="flex gap-2">
                                  {ipv4Route && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div>
                                          <Switch
                                            checked={ipv4Route.enabled}
                                            onCheckedChange={(checked) =>
                                              handleToggle(ipv4Route, checked)
                                            }
                                            disabled={toggleRoute.isPending}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>Toggle IPv4 exit</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {ipv6Route && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div>
                                          <Switch
                                            checked={ipv6Route.enabled}
                                            onCheckedChange={(checked) =>
                                              handleToggle(ipv6Route, checked)
                                            }
                                            disabled={toggleRoute.isPending}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>Toggle IPv6 exit</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subnet Routes Tab */}
        <TabsContent value="subnets">
          <Card>
            <CardHeader>
              <CardTitle>Subnet Routes</CardTitle>
              <CardDescription>
                {subnetRoutes.length} subnet route{subnetRoutes.length !== 1 ? 's' : ''} (
                {enabledSubnetCount} enabled)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSubnetRoutes.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No subnet routes match your filters
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Node</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Primary</TableHead>
                        {canToggle && <TableHead className="w-[80px]">Enabled</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubnetRoutes.map((route) => (
                        <TableRow key={route.id}>
                          <TableCell className="font-mono text-sm">{route.prefix}</TableCell>
                          <TableCell>
                            <div>
                              <div>{route.node.givenName || route.node.name}</div>
                              <code className="text-xs text-muted-foreground">
                                {route.node.ipAddresses[0]}
                              </code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={route.enabled ? 'default' : 'secondary'}>
                              {route.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {route.isPrimary ? (
                              <Badge variant="outline" className="text-xs">
                                Primary
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {canToggle && (
                            <TableCell>
                              <Switch
                                checked={route.enabled}
                                onCheckedChange={(checked) => handleToggle(route, checked)}
                                disabled={toggleRoute.isPending}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}

function RoutesClientSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-10 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-4">
        <div className="h-10 flex-1 animate-pulse rounded bg-muted" />
        <div className="h-10 w-[130px] animate-pulse rounded bg-muted" />
        <div className="h-10 w-[150px] animate-pulse rounded bg-muted" />
      </div>
      <Card>
        <CardHeader>
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
