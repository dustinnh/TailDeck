'use client';

import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SecurityWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  remediation?: string;
  canDismiss: boolean;
}

interface SecurityWarningCardProps {
  warning: SecurityWarning;
  onDismiss?: (id: string) => void;
  className?: string;
}

const severityConfig = {
  critical: {
    icon: ShieldAlert,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    label: 'Info',
  },
};

export function SecurityWarningCard({ warning, onDismiss, className }: SecurityWarningCardProps) {
  const config = severityConfig[warning.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {warning.canDismiss && onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={() => onDismiss(warning.id)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}

      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', config.color)}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{warning.title}</h4>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                config.bgColor,
                config.color
              )}
            >
              {config.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{warning.description}</p>
          {warning.remediation && (
            <div className="mt-2 rounded bg-background/50 p-2">
              <p className="text-xs font-medium text-foreground">How to fix:</p>
              <p className="text-xs text-muted-foreground">{warning.remediation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SecurityWarningListProps {
  warnings: SecurityWarning[];
  onDismiss?: (id: string) => void;
  className?: string;
}

export function SecurityWarningList({ warnings, onDismiss, className }: SecurityWarningListProps) {
  if (warnings.length === 0) {
    return (
      <div className={cn('rounded-lg border border-green-500/20 bg-green-500/10 p-4', className)}>
        <div className="flex items-center gap-3">
          <div className="text-green-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-medium">No Security Issues</h4>
            <p className="text-sm text-muted-foreground">
              Your configuration passes all security checks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sort by severity (critical first)
  const sortedWarnings = [...warnings].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className={cn('space-y-3', className)}>
      {sortedWarnings.map((warning) => (
        <SecurityWarningCard key={warning.id} warning={warning} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
