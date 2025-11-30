'use client';

import { Plus, X, Trash2, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useDNS, useUpdateDNS, type DNSConfiguration } from '@/lib/api/hooks/use-dns';

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

export function DNSClient() {
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const canEdit = hasMinRole(userRoles, 'ADMIN');

  const { data: dns, isLoading, error, refetch } = useDNS();
  const updateMutation = useUpdateDNS();

  const [formData, setFormData] = useState<Partial<DNSConfiguration>>({
    nameservers: [],
    domains: [],
    magicDNS: false,
    baseDomain: '',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newNameserver, setNewNameserver] = useState('');
  const [newDomain, setNewDomain] = useState('');

  // Initialize form when DNS loads
  useEffect(() => {
    if (dns) {
      setFormData({
        nameservers: dns.nameservers || [],
        domains: dns.domains || [],
        magicDNS: dns.magicDNS || false,
        baseDomain: dns.baseDomain || '',
      });
      setIsDirty(false);
    }
  }, [dns]);

  const handleAddNameserver = () => {
    const trimmed = newNameserver.trim();
    if (!trimmed) return;

    // Basic IP validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    if (!ipv4Regex.test(trimmed) && !ipv6Regex.test(trimmed)) {
      return;
    }

    if (!formData.nameservers?.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        nameservers: [...(prev.nameservers || []), trimmed],
      }));
      setIsDirty(true);
    }
    setNewNameserver('');
  };

  const handleRemoveNameserver = (ns: string) => {
    setFormData((prev) => ({
      ...prev,
      nameservers: (prev.nameservers || []).filter((n) => n !== ns),
    }));
    setIsDirty(true);
  };

  const handleAddDomain = () => {
    const trimmed = newDomain.trim();
    if (!trimmed) return;

    if (!formData.domains?.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        domains: [...(prev.domains || []), trimmed],
      }));
      setIsDirty(true);
    }
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    setFormData((prev) => ({
      ...prev,
      domains: (prev.domains || []).filter((d) => d !== domain),
    }));
    setIsDirty(true);
  };

  const handleMagicDNSChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      magicDNS: checked,
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(formData);
      setIsDirty(false);
      setSuccessMessage('DNS settings updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      // Error handled by mutation
    }
  };

  const handleReset = () => {
    if (dns) {
      setFormData({
        nameservers: dns.nameservers || [],
        domains: dns.domains || [],
        magicDNS: dns.magicDNS || false,
        baseDomain: dns.baseDomain || '',
      });
      setIsDirty(false);
    }
  };

  if (isLoading) {
    return <DNSClientSkeleton />;
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotSupported = errorMessage.includes('Not Found') || errorMessage.includes('404');

    if (isNotSupported) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>DNS Configuration</CardTitle>
            <CardDescription>DNS API not available in your Headscale version</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Configuration via config file</AlertTitle>
              <AlertDescription>
                Headscale v0.23 does not expose DNS settings through the REST API. DNS settings must
                be configured directly in your Headscale <code>config.yaml</code> file.
              </AlertDescription>
            </Alert>
            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 font-medium">Example DNS configuration:</h4>
              <pre className="overflow-x-auto text-sm">
                {`dns:
  base_domain: example.com
  magic_dns: true
  nameservers:
    global:
      - 1.1.1.1
      - 8.8.8.8
  search_domains:
    - example.com`}
              </pre>
            </div>
            <p className="text-sm text-muted-foreground">
              After updating your config file, restart Headscale for changes to take effect.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading DNS Settings</CardTitle>
          <CardDescription>Failed to fetch DNS configuration from Headscale</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{errorMessage}</p>
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
          You need ADMIN role or higher to view and edit DNS settings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <AlertTitle className="text-green-700 dark:text-green-300">Success</AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-400">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {updateMutation.isError && (
        <Alert className="border-destructive">
          <AlertTitle>Error saving settings</AlertTitle>
          <AlertDescription>
            {updateMutation.error instanceof Error ? updateMutation.error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {/* MagicDNS Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>MagicDNS</CardTitle>
              <CardDescription>
                Enable automatic DNS resolution for devices using their hostnames.
              </CardDescription>
            </div>
            <Switch checked={formData.magicDNS} onCheckedChange={handleMagicDNSChange} />
          </div>
        </CardHeader>
        {formData.magicDNS && dns?.baseDomain && (
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Base domain: <code className="text-foreground">{dns.baseDomain}</code>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Nameservers Card */}
      <Card>
        <CardHeader>
          <CardTitle>DNS Nameservers</CardTitle>
          <CardDescription>
            Configure custom DNS nameservers for your network. These will be pushed to all connected
            devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter IP address (e.g., 8.8.8.8)"
              value={newNameserver}
              onChange={(e) => setNewNameserver(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNameserver()}
            />
            <Button onClick={handleAddNameserver} size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {formData.nameservers && formData.nameservers.length > 0 ? (
            <div className="space-y-2">
              {formData.nameservers.map((ns) => (
                <div
                  key={ns}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <code className="text-sm">{ns}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveNameserver(ns)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No nameservers configured. Devices will use their default DNS.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Search Domains Card */}
      <Card>
        <CardHeader>
          <CardTitle>Search Domains</CardTitle>
          <CardDescription>
            Configure DNS search domains for short hostname resolution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter domain (e.g., example.com)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
            />
            <Button onClick={handleAddDomain} size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {formData.domains && formData.domains.length > 0 ? (
            <div className="space-y-2">
              {formData.domains.map((domain) => (
                <div
                  key={domain}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <code className="text-sm">{domain}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveDomain(domain)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No search domains configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Save/Reset Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!isDirty || updateMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Reset Changes
        </Button>
        <div className="flex items-center gap-4">
          {isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DNSClientSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-6 w-10 animate-pulse rounded-full bg-muted" />
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-6 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
