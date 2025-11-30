'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const api = {
  async getPolicy(): Promise<{ policy: string; updatedAt: { seconds: string; nanos: number } }> {
    const res = await fetch('/api/headscale/policy');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch policy');
    }
    return res.json();
  },

  async setPolicy(policy: string): Promise<{ policy: string }> {
    const res = await fetch('/api/headscale/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update policy');
    }
    return res.json();
  },
};

export function PoliciesClient() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const canEdit = hasMinRole(userRoles, 'ADMIN');

  const queryClient = useQueryClient();

  const {
    data: policyData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.policy.current(),
    queryFn: api.getPolicy,
  });

  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize editor content when policy loads
  useEffect(() => {
    if (policyData?.policy) {
      try {
        const formatted = JSON.stringify(JSON.parse(policyData.policy), null, 2);
        setEditorContent(formatted);
        setIsDirty(false);
        setJsonError(null);
      } catch {
        setEditorContent(policyData.policy);
      }
    }
  }, [policyData]);

  const updateMutation = useMutation({
    mutationFn: (policy: string) => api.setPolicy(policy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policy.current() });
      setIsDirty(false);
      setSuccessMessage('Policy updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const handleEditorChange = useCallback(
    (value: string) => {
      setEditorContent(value);
      setIsDirty(value !== JSON.stringify(JSON.parse(policyData?.policy || '{}'), null, 2));

      // Validate JSON
      try {
        JSON.parse(value);
        setJsonError(null);
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      }
    },
    [policyData?.policy]
  );

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(editorContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditorContent(formatted);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON - cannot format');
    }
  };

  const handleSave = () => {
    if (jsonError) return;
    setConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    setConfirmDialog(false);
    try {
      // Minify before sending
      const minified = JSON.stringify(JSON.parse(editorContent));
      await updateMutation.mutateAsync(minified);
    } catch {
      // Error is handled by mutation
    }
  };

  const handleReset = () => {
    if (policyData?.policy) {
      try {
        const formatted = JSON.stringify(JSON.parse(policyData.policy), null, 2);
        setEditorContent(formatted);
        setIsDirty(false);
        setJsonError(null);
      } catch {
        setEditorContent(policyData.policy);
      }
    }
  };

  if (isLoading) {
    return <PoliciesClientSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Policy</CardTitle>
          <CardDescription>Failed to fetch ACL policy from Headscale</CardDescription>
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

  if (!canEdit) {
    return (
      <Alert>
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You need ADMIN role or higher to view and edit ACL policies.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ACL Policy Editor</CardTitle>
              <CardDescription>
                Edit the JSON policy that controls access between nodes.{' '}
                <a
                  href="https://headscale.net/acls/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Documentation
                </a>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
              <Button variant="outline" size="sm" onClick={handleFormat}>
                Format
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
              <AlertTitle className="text-green-700 dark:text-green-300">Success</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}
          {updateMutation.isError && (
            <Alert className="mb-4 border-destructive">
              <AlertTitle>Error saving policy</AlertTitle>
              <AlertDescription>
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}
          {jsonError && (
            <Alert className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950">
              <AlertTitle className="text-orange-700 dark:text-orange-300">Invalid JSON</AlertTitle>
              <AlertDescription className="font-mono text-sm text-orange-600 dark:text-orange-400">
                {jsonError}
              </AlertDescription>
            </Alert>
          )}
          <div className="relative">
            <textarea
              className="h-[500px] w-full resize-none rounded-md border bg-muted/50 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={editorContent}
              onChange={(e) => handleEditorChange(e.target.value)}
              spellCheck={false}
              placeholder="Loading policy..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {editorContent.length} characters
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty || updateMutation.isPending}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || !!jsonError || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Policy'}
          </Button>
        </CardFooter>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Policy Update</DialogTitle>
            <DialogDescription>
              Are you sure you want to update the ACL policy? This will immediately affect network
              access for all nodes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSave}>Update Policy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PoliciesClientSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-[500px] animate-pulse rounded bg-muted" />
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <div className="h-10 w-20 animate-pulse rounded bg-muted" />
        <div className="h-10 w-28 animate-pulse rounded bg-muted" />
      </CardFooter>
    </Card>
  );
}
