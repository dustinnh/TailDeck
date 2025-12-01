'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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

interface HeadscaleUser {
  id: string;
  name: string;
  createdAt: { seconds: string; nanos: number };
}

interface PreAuthKey {
  id: string;
  key: string;
  user: string;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: { seconds: string; nanos: number };
  createdAt: { seconds: string; nanos: number };
  aclTags: string[];
}

async function fetchUsers(): Promise<{ users: HeadscaleUser[] }> {
  const res = await fetch('/api/headscale/users');
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch users');
  }
  return res.json();
}

async function createKey(params: {
  user: string;
  reusable: boolean;
  ephemeral: boolean;
  expiration?: string;
  aclTags?: string[];
}): Promise<{ preAuthKey: PreAuthKey }> {
  const res = await fetch('/api/headscale/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create key');
  }
  return res.json();
}

export function AddDeviceClient() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const canCreate = hasMinRole(userRoles, 'OPERATOR');

  const [step, setStep] = useState<'configure' | 'result'>('configure');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [expirationDays, setExpirationDays] = useState('7');
  const [tags, setTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<PreAuthKey | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    data: usersData,
    isLoading: loadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: queryKeys.headscaleUsers.list(),
    queryFn: fetchUsers,
    enabled: canCreate,
  });

  const users = usersData?.users ?? [];

  // Auto-select Headscale user based on auth user's email prefix
  const userEmail = session?.user?.email;
  useEffect(() => {
    if (userEmail && users.length > 0 && !selectedUser) {
      const emailPrefix = userEmail.split('@')[0]?.toLowerCase();
      if (emailPrefix) {
        const matchingUser = users.find((u) => u.name.toLowerCase() === emailPrefix);
        if (matchingUser) {
          setSelectedUser(matchingUser.name);
        }
      }
    }
  }, [userEmail, users, selectedUser]);

  if (!canCreate) {
    return (
      <Alert>
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You need OPERATOR role or higher to create preauth keys.
        </AlertDescription>
      </Alert>
    );
  }

  if (loadingUsers) {
    return <AddDeviceSkeleton />;
  }

  if (usersError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>Failed to load Headscale users</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {usersError instanceof Error ? usersError.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleCreate = async () => {
    if (!selectedUser) return;

    setIsCreating(true);
    setError(null);

    try {
      // Calculate expiration timestamp
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + parseInt(expirationDays, 10));

      // Parse tags
      const aclTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith('tag:') ? t : `tag:${t}`));

      const result = await createKey({
        user: selectedUser,
        reusable,
        ephemeral,
        expiration: expiration.toISOString(),
        aclTags: aclTags.length > 0 ? aclTags : undefined,
      });

      setCreatedKey(result.preAuthKey);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setStep('configure');
    setCreatedKey(null);
    setSelectedUser('');
    setReusable(false);
    setEphemeral(false);
    setExpirationDays('7');
    setTags('');
    setError(null);
  };

  // Get headscale URL for the QR code
  const headscaleUrl = process.env.NEXT_PUBLIC_HEADSCALE_URL || 'https://your-headscale-server';
  const loginCommand = createdKey
    ? `tailscale up --login-server ${headscaleUrl} --authkey ${createdKey.key}`
    : '';

  if (step === 'result' && createdKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Key Created Successfully
            <Badge variant="default">Active</Badge>
          </CardTitle>
          <CardDescription>Use this key to register a new device to your network.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex flex-col items-center rounded-lg bg-white p-6">
            <QRCodeSVG value={loginCommand} size={200} level="M" />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Scan with Tailscale app to connect
            </p>
          </div>

          {/* Key Display */}
          <div className="space-y-2">
            <Label>Auth Key</Label>
            <div className="flex gap-2">
              <Input value={createdKey.key} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={handleCopyKey}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Command */}
          <div className="space-y-2">
            <Label>Login Command</Label>
            <div className="break-all rounded-md bg-muted p-3 font-mono text-sm">
              {loginCommand}
            </div>
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">User:</span>{' '}
              <span className="font-medium">{createdKey.user}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Reusable:</span>{' '}
              <span className="font-medium">{createdKey.reusable ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ephemeral:</span>{' '}
              <span className="font-medium">{createdKey.ephemeral ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Expires:</span>{' '}
              <span className="font-medium">
                {new Date(parseInt(createdKey.expiration.seconds, 10) * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>

          {createdKey.aclTags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1">
                {createdKey.aclTags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag.replace('tag:', '')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Alert>
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              This key will only be shown once. Make sure to save it securely or use the QR code to
              add your device now.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleReset}>Create Another Key</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Preauth Key</CardTitle>
        <CardDescription>
          Create a key that allows devices to join your network automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* User Selection */}
        <div className="space-y-2">
          <Label htmlFor="user">Headscale User</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger id="user">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.name}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Devices registered with this key will belong to this user.
          </p>
        </div>

        {/* Expiration */}
        <div className="space-y-2">
          <Label htmlFor="expiration">Expiration (days)</Label>
          <Select value={expirationDays} onValueChange={setExpirationDays}>
            <SelectTrigger id="expiration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reusable">Reusable</Label>
              <p className="text-xs text-muted-foreground">
                Allow multiple devices to use this key
              </p>
            </div>
            <Switch id="reusable" checked={reusable} onCheckedChange={setReusable} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ephemeral">Ephemeral</Label>
              <p className="text-xs text-muted-foreground">
                Device will be removed when it goes offline
              </p>
            </div>
            <Switch id="ephemeral" checked={ephemeral} onCheckedChange={setEphemeral} />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label htmlFor="tags">ACL Tags (optional)</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="server, production"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list of tags. The &quot;tag:&quot; prefix is added automatically.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleReset} disabled={isCreating}>
          Reset
        </Button>
        <Button onClick={handleCreate} disabled={!selectedUser || isCreating}>
          {isCreating ? 'Creating...' : 'Generate Key'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function AddDeviceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
