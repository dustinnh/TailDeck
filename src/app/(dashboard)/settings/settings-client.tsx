'use client';

import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
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

interface UserWithRoles {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string;
  roles: { name: string; source: string }[];
}

interface AvailableRole {
  id: string;
  name: string;
  description: string | null;
}

interface SettingsClientProps {
  initialUsers: UserWithRoles[];
  availableRoles: AvailableRole[];
}

export function SettingsClient({ initialUsers, availableRoles }: SettingsClientProps) {
  const router = useRouter();
  const [users] = useState(initialUsers);
  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    user: UserWithRoles | null;
    selectedRole: string;
  }>({ open: false, user: null, selectedRole: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAssignRole = async () => {
    if (!roleDialog.user || !roleDialog.selectedRole) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: roleDialog.user.id,
          roleName: roleDialog.selectedRole,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to assign role');
      }

      setRoleDialog({ open: false, user: null, selectedRole: '' });
      router.refresh();
    } catch (error) {
      console.error('Failed to assign role:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveRole = async (userId: string, roleName: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleName }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to remove role');
      }

      router.refresh();
    } catch (error) {
      console.error('Failed to remove role:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get roles user doesn't have yet
  const getAvailableRolesForUser = (user: UserWithRoles) => {
    const userRoleNames = user.roles.map((r) => r.name);
    return availableRoles.filter((r) => !userRoleNames.includes(r.name));
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* User Role Management */}
        <Card>
          <CardHeader>
            <CardTitle>User Roles</CardTitle>
            <CardDescription>
              Manage database role overrides. OIDC-synced roles are shown but cannot be removed from
              here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No users have logged in yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {user.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={user.image}
                                alt={user.name || ''}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{user.name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length === 0 ? (
                              <span className="text-sm text-muted-foreground">No roles</span>
                            ) : (
                              user.roles.map((role) => (
                                <Tooltip key={role.name}>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant={role.source === 'OIDC' ? 'secondary' : 'default'}
                                      className="cursor-help text-xs"
                                    >
                                      {role.name}
                                      {role.source === 'DATABASE' && (
                                        <button
                                          className="ml-1 hover:text-destructive"
                                          onClick={() => handleRemoveRole(user.id, role.name)}
                                          disabled={isSubmitting}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {role.source === 'OIDC'
                                      ? 'Synced from Authentik groups'
                                      : 'Database override'}
                                  </TooltipContent>
                                </Tooltip>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger>
                              {formatDistanceToNow(new Date(user.createdAt), {
                                addSuffix: true,
                              })}
                            </TooltipTrigger>
                            <TooltipContent>
                              {new Date(user.createdAt).toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {getAvailableRolesForUser(user).length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setRoleDialog({
                                  open: true,
                                  user,
                                  selectedRole: '',
                                })
                              }
                            >
                              Add Role
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Roles Info */}
        <Card>
          <CardHeader>
            <CardTitle>Role Hierarchy</CardTitle>
            <CardDescription>
              Available roles and their permissions in descending order of access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {availableRoles
                .sort((a, b) => {
                  const order = ['OWNER', 'ADMIN', 'OPERATOR', 'AUDITOR', 'USER'];
                  return order.indexOf(a.name) - order.indexOf(b.name);
                })
                .map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <Badge variant="outline" className="mr-2">
                        {role.name}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{role.description}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Role Dialog */}
      <Dialog
        open={roleDialog.open}
        onOpenChange={(open) =>
          !open && setRoleDialog({ open: false, user: null, selectedRole: '' })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Add a database role override for {roleDialog.user?.name || roleDialog.user?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={roleDialog.selectedRole}
              onValueChange={(value) => setRoleDialog((s) => ({ ...s, selectedRole: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleDialog.user &&
                  getAvailableRolesForUser(roleDialog.user).map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                      {role.description && (
                        <span className="ml-2 text-muted-foreground">- {role.description}</span>
                      )}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialog({ open: false, user: null, selectedRole: '' })}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={!roleDialog.selectedRole || isSubmitting}>
              {isSubmitting ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
