'use client';

import { AlertCircle, Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFlowLogHealth } from '@/lib/api/hooks/use-flowlogs';

export function FlowLogsTab() {
  const { data: healthData, isLoading, error } = useFlowLogHealth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to check flow log status:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Flow Log Backend Status
            {healthData?.enabled && healthData.healthy && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {healthData?.enabled && !healthData.healthy && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            {!healthData?.enabled && <XCircle className="h-5 w-5 text-muted-foreground" />}
          </CardTitle>
          <CardDescription>
            {healthData?.enabled
              ? `Connected to ${healthData.provider} backend`
              : 'Flow logging is not configured'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-muted-foreground">Provider</div>
              <div className="capitalize">{healthData?.provider ?? 'None'}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">Status</div>
              <div
                className={
                  healthData?.healthy
                    ? 'text-green-600'
                    : healthData?.enabled
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                }
              >
                {healthData?.enabled
                  ? healthData.healthy
                    ? 'Healthy'
                    : 'Unhealthy'
                  : 'Not Configured'}
              </div>
            </div>
          </div>

          {healthData?.message && (
            <div className="text-sm text-muted-foreground">{healthData.message}</div>
          )}

          {!healthData?.enabled && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Configuration Required</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  To enable flow logging, set the following environment variables:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>
                    <code className="rounded bg-muted px-1">LOKI_URL</code> - Loki server URL
                  </li>
                  <li>
                    <code className="rounded bg-muted px-1">LOKI_TENANT_ID</code> - (Optional)
                    Multi-tenant ID
                  </li>
                  <li>
                    <code className="rounded bg-muted px-1">LOKI_USERNAME</code> /{' '}
                    <code className="rounded bg-muted px-1">LOKI_PASSWORD</code> - (Optional)
                    Authentication
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Link to full Flow Logs page */}
      {healthData?.enabled && healthData.healthy && (
        <Card>
          <CardHeader>
            <CardTitle>View Flow Logs</CardTitle>
            <CardDescription>
              Access the full flow logs explorer to search and analyze network traffic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/flow-logs">
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Flow Logs Explorer
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
