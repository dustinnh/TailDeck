'use client';

import { formatDistanceToNow, format, addDays, isPast } from 'date-fns';
import { Plus, Copy, Trash2, Clock, Key, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  useExpireApiKey,
  type ApiKey,
} from '@/lib/api/hooks/use-apikeys';

type RoleName = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'USER';

function hasRole(userRoles: RoleName[], role: RoleName): boolean {
  return userRoles.includes(role);
}

function parseTimestamp(ts: { seconds: string; nanos: number }): Date {
  return new Date(parseInt(ts.seconds, 10) * 1000 + ts.nanos / 1000000);
}

function isExpired(expiration: { seconds: string; nanos: number }): boolean {
  const expiryDate = parseTimestamp(expiration);
  return isPast(expiryDate);
}

export function ApiKeysClient() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const isOwner = hasRole(userRoles, 'OWNER');

  const { data: apiKeys, isLoading, error, refetch } = useApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();
  const expireMutation = useExpireApiKey();

  const [createDialog, setCreateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<ApiKey | null>(null);
  const [newKeyDialog, setNewKeyDialog] = useState<string | null>(null);
  const [expirationDays, setExpirationDays] = useState('90');
  const [copied, setCopied] = useState(false);

  const handleCreateKey = async () => {
    const days = parseInt(expirationDays, 10);
    const expiration = addDays(new Date(), days).toISOString();

    try {
      const result = await createMutation.mutateAsync(expiration);
      setCreateDialog(false);
      setNewKeyDialog(result.apiKey);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteDialog) return;

    try {
      await deleteMutation.mutateAsync(deleteDialog.prefix);
      setDeleteDialog(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleExpireKey = async (prefix: string) => {
    try {
      await expireMutation.mutateAsync(prefix);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <ApiKeysClientSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading API Keys</CardTitle>
          <CardDescription>Failed to fetch API keys from Headscale</CardDescription>
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

  if (!isOwner) {
    return (
      <Alert>
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You need OWNER role to manage API keys. These are sensitive credentials that provide full
          access to the Headscale API.
        </AlertDescription>
      </Alert>
    );
  }

  const activeKeys = apiKeys?.filter((k) => !isExpired(k.expiration)) ?? [];
  const expiredKeys = apiKeys?.filter((k) => isExpired(k.expiration)) ?? [];

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertTitle className="text-orange-700 dark:text-orange-300">Security Notice</AlertTitle>
        <AlertDescription className="text-orange-600 dark:text-orange-400">
          API keys provide full access to the Headscale API. Keep them secure and rotate them
          regularly. New keys are only shown once.
        </AlertDescription>
      </Alert>

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {activeKeys.length} active key{activeKeys.length !== 1 ? 's' : ''}
          {expiredKeys.length > 0 && `, ${expiredKeys.length} expired`}
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {/* Active Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
          <CardDescription>Keys that are currently valid for API access.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-mono">{key.prefix}...</TableCell>
                    <TableCell>
                      {formatDistanceToNow(parseTimestamp(key.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>{format(parseTimestamp(key.expiration), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {key.lastSeen
                        ? formatDistanceToNow(parseTimestamp(key.lastSeen), {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExpireKey(key.prefix)}
                          disabled={expireMutation.isPending}
                        >
                          <Clock className="mr-1 h-4 w-4" />
                          Expire
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog(key)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No active API keys</p>
              <p className="text-sm text-muted-foreground">
                Create a key to enable programmatic access.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expired Keys (collapsed) */}
      {expiredKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground">Expired Keys</CardTitle>
            <CardDescription>
              Keys that are no longer valid. Consider deleting them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Expired</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredKeys.map((key) => (
                  <TableRow key={key.id} className="opacity-60">
                    <TableCell className="font-mono">{key.prefix}...</TableCell>
                    <TableCell>
                      {formatDistanceToNow(parseTimestamp(key.expiration), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog(key)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Key Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access to Headscale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expiration">Expires in (days)</Label>
              <Input
                id="expiration"
                type="number"
                min="1"
                max="365"
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Key will expire on{' '}
                {format(addDays(new Date(), parseInt(expirationDays, 10) || 90), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={!!newKeyDialog} onOpenChange={() => setNewKeyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-600 dark:text-orange-400">
                This is the only time you&apos;ll see this key. Make sure to copy it now.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted p-3 text-sm">{newKeyDialog}</code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => newKeyDialog && handleCopyKey(newKeyDialog)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied && (
              <p className="text-sm text-green-600 dark:text-green-400">Copied to clipboard!</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the API key starting with{' '}
              <code className="text-foreground">{deleteDialog?.prefix}</code>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteKey}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApiKeysClientSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-lg border bg-muted" />
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-36 animate-pulse rounded bg-muted" />
      </div>
      <Card>
        <CardHeader>
          <div className="h-6 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
