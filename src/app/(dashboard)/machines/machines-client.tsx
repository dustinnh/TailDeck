'use client';

import { formatDistanceToNow } from 'date-fns';
import { Trash2, Clock, UserPlus, Tag, Loader2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useBulkOperation } from '@/lib/api/hooks/use-bulk-operations';
import {
  useNodes,
  useRenameNode,
  useUpdateNodeTags,
  useExpireNode,
  useDeleteNode,
  useMoveNode,
  type Node,
} from '@/lib/api/hooks/use-nodes';
import { useHeadscaleUsers } from '@/lib/api/hooks/use-users';

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

function formatTimestamp(timestamp: { seconds: string; nanos: number }): Date {
  const ms = parseInt(timestamp.seconds, 10) * 1000 + Math.floor(timestamp.nanos / 1000000);
  return new Date(ms);
}

export function MachinesClient() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const canEdit = hasMinRole(userRoles, 'OPERATOR');
  const canDelete = hasMinRole(userRoles, 'ADMIN');

  const { data: nodes, isLoading, error, refetch } = useNodes();
  const { data: headscaleUsers } = useHeadscaleUsers();
  const renameNode = useRenameNode();
  const updateTags = useUpdateNodeTags();
  const expireNode = useExpireNode();
  const deleteNode = useDeleteNode();
  const moveNode = useMoveNode();
  const bulkOperation = useBulkOperation();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Selection state for bulk operations
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  // Dialog states
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    node: Node | null;
    newName: string;
  }>({ open: false, node: null, newName: '' });

  const [tagsDialog, setTagsDialog] = useState<{
    open: boolean;
    node: Node | null;
    tags: string;
  }>({ open: false, node: null, tags: '' });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    node: Node | null;
  }>({ open: false, node: null });

  const [expireDialog, setExpireDialog] = useState<{
    open: boolean;
    node: Node | null;
  }>({ open: false, node: null });

  const [moveDialog, setMoveDialog] = useState<{
    open: boolean;
    node: Node | null;
    newUser: string;
  }>({ open: false, node: null, newUser: '' });

  // Bulk dialog states
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkExpireDialog, setBulkExpireDialog] = useState(false);
  const [bulkMoveDialog, setBulkMoveDialog] = useState<{
    open: boolean;
    newUser: string;
  }>({ open: false, newUser: '' });
  const [bulkTagsDialog, setBulkTagsDialog] = useState<{
    open: boolean;
    tags: string;
  }>({ open: false, tags: '' });
  const [bulkResult, setBulkResult] = useState<{
    show: boolean;
    succeeded: number;
    failed: number;
  } | null>(null);

  if (isLoading) {
    return <MachinesClientSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Machines</CardTitle>
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

  if (!nodes || nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Machines Found</CardTitle>
          <CardDescription>
            There are no machines registered in your Headscale network yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Register a new machine using the Headscale CLI or Tailscale client.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get unique users and tags for filter
  const users = Array.from(new Set(nodes.map((n) => n.user.name))).sort();
  const allTags = Array.from(
    new Set(nodes.flatMap((n) => n.forcedTags.map((t) => t.replace(/^tag:/, ''))))
  ).sort();

  // Check if any filters are active
  const hasActiveFilters =
    search !== '' || statusFilter !== 'all' || userFilter !== 'all' || tagFilter !== 'all';

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setUserFilter('all');
    setTagFilter('all');
  };

  // Filter nodes
  const filteredNodes = nodes.filter((node) => {
    const matchesSearch =
      search === '' ||
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.givenName?.toLowerCase().includes(search.toLowerCase()) ||
      node.ipAddresses.some((ip) => ip.includes(search)) ||
      node.forcedTags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && node.online) ||
      (statusFilter === 'offline' && !node.online);

    const matchesUser = userFilter === 'all' || node.user.name === userFilter;

    const matchesTag =
      tagFilter === 'all' ||
      node.forcedTags.some((t) => t === `tag:${tagFilter}` || t === tagFilter);

    return matchesSearch && matchesStatus && matchesUser && matchesTag;
  });

  const onlineCount = nodes.filter((n) => n.online).length;

  // Handlers
  const handleRename = async () => {
    if (!renameDialog.node || !renameDialog.newName.trim()) return;
    try {
      await renameNode.mutateAsync({
        id: renameDialog.node.id,
        newName: renameDialog.newName.trim(),
      });
      setRenameDialog({ open: false, node: null, newName: '' });
    } catch {
      // Error is handled by mutation
    }
  };

  const handleUpdateTags = async () => {
    if (!tagsDialog.node) return;
    const tags = tagsDialog.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('tag:') ? t : `tag:${t}`));
    try {
      await updateTags.mutateAsync({
        id: tagsDialog.node.id,
        tags,
      });
      setTagsDialog({ open: false, node: null, tags: '' });
    } catch {
      // Error is handled by mutation
    }
  };

  const handleExpire = async () => {
    if (!expireDialog.node) return;
    try {
      await expireNode.mutateAsync(expireDialog.node.id);
      setExpireDialog({ open: false, node: null });
    } catch {
      // Error is handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.node) return;
    try {
      await deleteNode.mutateAsync(deleteDialog.node.id);
      setDeleteDialog({ open: false, node: null });
    } catch {
      // Error is handled by mutation
    }
  };

  const handleMove = async () => {
    if (!moveDialog.node || !moveDialog.newUser) return;
    try {
      await moveNode.mutateAsync({
        id: moveDialog.node.id,
        user: moveDialog.newUser,
      });
      setMoveDialog({ open: false, node: null, newUser: '' });
    } catch {
      // Error is handled by mutation
    }
  };

  // Selection handlers
  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedNodes.size === filteredNodes.length) {
      setSelectedNodes(new Set());
    } else {
      setSelectedNodes(new Set(filteredNodes.map((n) => n.id)));
    }
  };

  const clearSelection = () => setSelectedNodes(new Set());

  // Bulk operation handlers
  const handleBulkDelete = async () => {
    try {
      const result = await bulkOperation.mutateAsync({
        action: 'delete',
        nodeIds: Array.from(selectedNodes),
      });
      setBulkDeleteDialog(false);
      setBulkResult({
        show: true,
        succeeded: result.summary.succeeded,
        failed: result.summary.failed,
      });
      clearSelection();
      setTimeout(() => setBulkResult(null), 5000);
    } catch {
      // Error handled by mutation
    }
  };

  const handleBulkExpire = async () => {
    try {
      const result = await bulkOperation.mutateAsync({
        action: 'expire',
        nodeIds: Array.from(selectedNodes),
      });
      setBulkExpireDialog(false);
      setBulkResult({
        show: true,
        succeeded: result.summary.succeeded,
        failed: result.summary.failed,
      });
      clearSelection();
      setTimeout(() => setBulkResult(null), 5000);
    } catch {
      // Error handled by mutation
    }
  };

  const handleBulkMove = async () => {
    if (!bulkMoveDialog.newUser) return;
    try {
      const result = await bulkOperation.mutateAsync({
        action: 'move',
        nodeIds: Array.from(selectedNodes),
        newUser: bulkMoveDialog.newUser,
      });
      setBulkMoveDialog({ open: false, newUser: '' });
      setBulkResult({
        show: true,
        succeeded: result.summary.succeeded,
        failed: result.summary.failed,
      });
      clearSelection();
      setTimeout(() => setBulkResult(null), 5000);
    } catch {
      // Error handled by mutation
    }
  };

  const handleBulkTags = async () => {
    const tags = bulkTagsDialog.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('tag:') ? t : `tag:${t}`));
    try {
      const result = await bulkOperation.mutateAsync({
        action: 'tags',
        nodeIds: Array.from(selectedNodes),
        tags,
      });
      setBulkTagsDialog({ open: false, tags: '' });
      setBulkResult({
        show: true,
        succeeded: result.summary.succeeded,
        failed: result.summary.failed,
      });
      clearSelection();
      setTimeout(() => setBulkResult(null), 5000);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Network Machines</CardTitle>
              <CardDescription>
                {nodes.length} machine{nodes.length !== 1 ? 's' : ''} ({onlineCount} online)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="min-w-[200px] flex-1">
              <Input
                placeholder="Search by name, IP, or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | 'online' | 'offline')}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Bulk Result Alert */}
          {bulkResult?.show && (
            <Alert
              className={
                bulkResult.failed > 0
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                  : 'border-green-500 bg-green-50 dark:bg-green-950'
              }
            >
              <AlertDescription
                className={
                  bulkResult.failed > 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-green-600 dark:text-green-400'
                }
              >
                Bulk operation completed: {bulkResult.succeeded} succeeded
                {bulkResult.failed > 0 && `, ${bulkResult.failed} failed`}
              </AlertDescription>
            </Alert>
          )}

          {/* Bulk Actions Toolbar */}
          {selectedNodes.size > 0 && canEdit && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-muted/50 p-3">
              <span className="text-sm font-medium">{selectedNodes.size} selected</span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setBulkExpireDialog(true)}>
                <Clock className="mr-1 h-4 w-4" />
                Expire
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkMoveDialog({ open: true, newUser: '' })}
              >
                <UserPlus className="mr-1 h-4 w-4" />
                Move
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkTagsDialog({ open: true, tags: '' })}
              >
                <Tag className="mr-1 h-4 w-4" />
                Set Tags
              </Button>
              {canDelete && (
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialog(true)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {canEdit && (
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          filteredNodes.length > 0 && selectedNodes.size === filteredNodes.length
                        }
                        onCheckedChange={toggleAllSelection}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Name</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  {canEdit && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNodes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 8 : 6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No machines match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNodes.map((node) => (
                    <TableRow key={node.id}>
                      {canEdit && (
                        <TableCell>
                          <Checkbox
                            checked={selectedNodes.has(node.id)}
                            onCheckedChange={() => toggleNodeSelection(node.id)}
                            aria-label={`Select ${node.givenName || node.name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <div>
                          <div>{node.givenName || node.name}</div>
                          {node.givenName && node.givenName !== node.name && (
                            <div className="text-xs text-muted-foreground">{node.name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">{node.ipAddresses[0] || 'N/A'}</code>
                      </TableCell>
                      <TableCell>{node.user.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {node.forcedTags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag.replace('tag:', '')}
                            </Badge>
                          ))}
                          {node.forcedTags.length > 3 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs">
                                  +{node.forcedTags.length - 3}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {node.forcedTags
                                  .slice(3)
                                  .map((t) => t.replace('tag:', ''))
                                  .join(', ')}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={node.online ? 'default' : 'secondary'}>
                          {node.online ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            {formatDistanceToNow(formatTimestamp(node.lastSeen), {
                              addSuffix: true,
                            })}
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatTimestamp(node.lastSeen).toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <span className="sr-only">Actions</span>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="12" cy="12" r="1" />
                                  <circle cx="12" cy="5" r="1" />
                                  <circle cx="12" cy="19" r="1" />
                                </svg>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setRenameDialog({
                                    open: true,
                                    node,
                                    newName: node.givenName || node.name,
                                  })
                                }
                              >
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setTagsDialog({
                                    open: true,
                                    node,
                                    tags: node.forcedTags
                                      .map((t) => t.replace('tag:', ''))
                                      .join(', '),
                                  })
                                }
                              >
                                Edit Tags
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setMoveDialog({
                                    open: true,
                                    node,
                                    newUser: '',
                                  })
                                }
                              >
                                Move to User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-orange-600"
                                onClick={() => setExpireDialog({ open: true, node })}
                              >
                                Expire
                              </DropdownMenuItem>
                              {canDelete && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteDialog({ open: true, node })}
                                >
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialog.open}
        onOpenChange={(open) => !open && setRenameDialog({ open: false, node: null, newName: '' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Machine</DialogTitle>
            <DialogDescription>Enter a new display name for this machine.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={renameDialog.newName}
                onChange={(e) => setRenameDialog((s) => ({ ...s, newName: e.target.value }))}
                placeholder="Enter new name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialog({ open: false, node: null, newName: '' })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameNode.isPending || !renameDialog.newName.trim()}
            >
              {renameNode.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {renameNode.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Dialog */}
      <Dialog
        open={tagsDialog.open}
        onOpenChange={(open) => !open && setTagsDialog({ open: false, node: null, tags: '' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tags</DialogTitle>
            <DialogDescription>
              Enter tags separated by commas. Tags are used for ACL policies.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagsDialog.tags}
                onChange={(e) => setTagsDialog((s) => ({ ...s, tags: e.target.value }))}
                placeholder="server, production, web"
              />
              <p className="text-xs text-muted-foreground">
                The &quot;tag:&quot; prefix will be added automatically.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTagsDialog({ open: false, node: null, tags: '' })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateTags} disabled={updateTags.isPending}>
              {updateTags.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {updateTags.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expire Dialog */}
      <Dialog
        open={expireDialog.open}
        onOpenChange={(open) => !open && setExpireDialog({ open: false, node: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expire Machine</DialogTitle>
            <DialogDescription>
              Are you sure you want to expire{' '}
              <strong>{expireDialog.node?.givenName || expireDialog.node?.name}</strong>? The
              machine will need to re-authenticate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpireDialog({ open: false, node: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleExpire} disabled={expireNode.isPending}>
              {expireNode.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {expireNode.isPending ? 'Expiring...' : 'Expire'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, node: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Machine</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              <strong>{deleteDialog.node?.givenName || deleteDialog.node?.name}</strong>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, node: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteNode.isPending}>
              {deleteNode.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteNode.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog (Individual) */}
      <Dialog
        open={moveDialog.open}
        onOpenChange={(open) => !open && setMoveDialog({ open: false, node: null, newUser: '' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Machine</DialogTitle>
            <DialogDescription>
              Move <strong>{moveDialog.node?.givenName || moveDialog.node?.name}</strong> to a
              different user/namespace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-user">Target User</Label>
              <Select
                value={moveDialog.newUser}
                onValueChange={(value) => setMoveDialog((s) => ({ ...s, newUser: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {headscaleUsers?.map((u) => (
                    <SelectItem key={u.name} value={u.name}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveDialog({ open: false, node: null, newUser: '' })}
            >
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={moveNode.isPending || !moveDialog.newUser}>
              {moveNode.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {moveNode.isPending ? 'Moving...' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialog} onOpenChange={setBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedNodes.size} Machines</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedNodes.size} machine
              {selectedNodes.size !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkOperation.isPending}
            >
              {bulkOperation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bulkOperation.isPending ? 'Deleting...' : 'Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Expire Dialog */}
      <Dialog open={bulkExpireDialog} onOpenChange={setBulkExpireDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expire {selectedNodes.size} Machines</DialogTitle>
            <DialogDescription>
              Are you sure you want to expire {selectedNodes.size} machine
              {selectedNodes.size !== 1 ? 's' : ''}? They will need to re-authenticate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkExpireDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkExpire}
              disabled={bulkOperation.isPending}
            >
              {bulkOperation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bulkOperation.isPending ? 'Expiring...' : 'Expire All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Dialog */}
      <Dialog
        open={bulkMoveDialog.open}
        onOpenChange={(open) => !open && setBulkMoveDialog({ open: false, newUser: '' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedNodes.size} Machines</DialogTitle>
            <DialogDescription>
              Move {selectedNodes.size} machine
              {selectedNodes.size !== 1 ? 's' : ''} to a different user/namespace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bulk-new-user">Target User</Label>
              <Select
                value={bulkMoveDialog.newUser}
                onValueChange={(value) => setBulkMoveDialog((s) => ({ ...s, newUser: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {headscaleUsers?.map((u) => (
                    <SelectItem key={u.name} value={u.name}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkMoveDialog({ open: false, newUser: '' })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkMove}
              disabled={bulkOperation.isPending || !bulkMoveDialog.newUser}
            >
              {bulkOperation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bulkOperation.isPending ? 'Moving...' : 'Move All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Tags Dialog */}
      <Dialog
        open={bulkTagsDialog.open}
        onOpenChange={(open) => !open && setBulkTagsDialog({ open: false, tags: '' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Tags on {selectedNodes.size} Machines</DialogTitle>
            <DialogDescription>
              Set tags on {selectedNodes.size} machine
              {selectedNodes.size !== 1 ? 's' : ''}. This will replace existing tags.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bulk-tags">Tags</Label>
              <Input
                id="bulk-tags"
                value={bulkTagsDialog.tags}
                onChange={(e) => setBulkTagsDialog((s) => ({ ...s, tags: e.target.value }))}
                placeholder="server, production, web"
              />
              <p className="text-xs text-muted-foreground">
                Enter tags separated by commas. The &quot;tag:&quot; prefix will be added
                automatically.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagsDialog({ open: false, tags: '' })}>
              Cancel
            </Button>
            <Button onClick={handleBulkTags} disabled={bulkOperation.isPending}>
              {bulkOperation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bulkOperation.isPending ? 'Updating...' : 'Set Tags'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function MachinesClientSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-4">
          <div className="h-10 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-10 w-[130px] animate-pulse rounded bg-muted" />
          <div className="h-10 w-[150px] animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
