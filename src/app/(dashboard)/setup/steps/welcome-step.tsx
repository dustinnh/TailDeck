'use client';

import { Database, Key, Network, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { HealthDiagnostic, HealthOverview } from '../components/health-diagnostic';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
  latencyMs?: number;
}

interface WelcomeStepProps {
  diagnostics: {
    overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    services: {
      database: ServiceHealth;
      headscale: ServiceHealth;
      oidc: ServiceHealth;
    };
    counts: {
      nodes: number;
      users: number;
      routes: number;
    };
  };
}

export function WelcomeStep({ diagnostics }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to TailDeck</h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s verify your configuration and complete the setup.
        </p>
      </div>

      {/* Overall Status */}
      <HealthOverview status={diagnostics.overall} title="System Health" />

      {/* Service Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Services</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <HealthDiagnostic service={diagnostics.services.database} />
          <HealthDiagnostic service={diagnostics.services.headscale} />
          <HealthDiagnostic service={diagnostics.services.oidc} />
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Status</CardTitle>
          <CardDescription>Overview of your Headscale network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center">
                <Network className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{diagnostics.counts.nodes}</p>
              <p className="text-xs text-muted-foreground">Nodes</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{diagnostics.counts.users}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center">
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{diagnostics.counts.routes}</p>
              <p className="text-xs text-muted-foreground">Routes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="font-medium">What happens next?</h4>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            We&apos;ll verify your domain and HTTPS configuration
          </li>
          <li className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Check your MagicDNS and nameserver settings
          </li>
          <li className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Review security warnings and best practices
          </li>
        </ul>
      </div>
    </div>
  );
}
