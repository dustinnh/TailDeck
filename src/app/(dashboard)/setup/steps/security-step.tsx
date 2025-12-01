'use client';

import { Shield } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { SecurityWarningList } from '../components/security-warning';

interface SecurityWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  remediation?: string;
  canDismiss: boolean;
}

interface SecurityStepProps {
  warnings: SecurityWarning[];
  onDismissWarning: (id: string) => void;
}

export function SecurityStep({ warnings, onDismissWarning }: SecurityStepProps) {
  const criticalCount = warnings.filter((w) => w.severity === 'critical').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;
  const infoCount = warnings.filter((w) => w.severity === 'info').length;

  const hasBlockingIssues = warnings.some((w) => w.severity === 'critical' && !w.canDismiss);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Security Review</h1>
        <p className="mt-2 text-muted-foreground">
          Review security warnings before completing setup.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Security Summary
          </CardTitle>
          <CardDescription>
            {warnings.length === 0
              ? 'No security issues detected'
              : `${warnings.length} issue${warnings.length === 1 ? '' : 's'} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-yellow-500">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-blue-500">{infoCount}</p>
              <p className="text-xs text-muted-foreground">Info</p>
            </div>
          </div>

          {hasBlockingIssues && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
              <p className="font-medium">Critical issues must be resolved</p>
              <p className="text-muted-foreground">
                You cannot complete setup until all critical issues are addressed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warnings List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Security Issues</h3>
        <SecurityWarningList warnings={warnings} onDismiss={onDismissWarning} />
      </div>

      {/* Tips */}
      {warnings.length === 0 && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium">Security Best Practices</h4>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>- Regularly rotate API keys and secrets</li>
            <li>- Keep TailDeck and Headscale updated</li>
            <li>- Monitor audit logs for suspicious activity</li>
            <li>- Use ACL policies to restrict access</li>
          </ul>
        </div>
      )}
    </div>
  );
}
