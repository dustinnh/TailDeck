'use client';

import { CheckCircle2, Globe, Server, Wand2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DnsStepProps {
  environment: {
    magicDnsEnabled: boolean;
    magicDnsDomain?: string;
  };
}

export function DnsStep({ environment }: DnsStepProps) {
  // Default nameservers (from Headscale config)
  const nameservers = ['1.1.1.1', '8.8.8.8'];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">DNS Configuration</h1>
        <p className="mt-2 text-muted-foreground">Review your MagicDNS and nameserver settings.</p>
      </div>

      {/* MagicDNS Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-5 w-5" />
            MagicDNS
          </CardTitle>
          <CardDescription>Automatic DNS resolution for nodes in your tailnet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Badge variant={environment.magicDnsEnabled ? 'default' : 'secondary'}>
              {environment.magicDnsEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

          {environment.magicDnsEnabled && environment.magicDnsDomain && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Base Domain</span>
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {environment.magicDnsDomain}
              </code>
            </div>
          )}

          {environment.magicDnsEnabled && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  MagicDNS is configured
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Nodes will be accessible as{' '}
                <code className="rounded bg-background/50 px-1">
                  hostname.{environment.magicDnsDomain}
                </code>
              </p>
            </div>
          )}

          {!environment.magicDnsEnabled && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                MagicDNS is disabled. Nodes can only be reached by IP address. Enable MagicDNS in
                your Headscale configuration for easier access.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nameservers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5" />
            Nameservers
          </CardTitle>
          <CardDescription>DNS servers used for resolving external domains</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {nameservers.map((ns, index) => (
              <div
                key={ns}
                className="flex items-center justify-between rounded-lg border bg-muted/50 p-3"
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm">{ns}</code>
                </div>
                <Badge variant="outline" className="text-xs">
                  {index === 0 ? 'Primary' : 'Secondary'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DERP Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" />
            DERP Relay Servers
          </CardTitle>
          <CardDescription>Relay servers for NAT traversal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Using Tailscale DERP Network</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your nodes will use Tailscale&apos;s globally distributed DERP relay servers for
              optimal connectivity when direct connections aren&apos;t possible.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p>
          DNS settings are configured in{' '}
          <code className="rounded bg-muted px-1">headscale/config.yaml</code>. Restart Headscale
          after making changes.
        </p>
      </div>
    </div>
  );
}
