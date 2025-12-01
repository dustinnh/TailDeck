'use client';

import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
  latencyMs?: number;
}

interface HealthDiagnosticProps {
  service: ServiceHealth;
  className?: string;
}

const statusConfig = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    label: 'Healthy',
  },
  degraded: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    label: 'Degraded',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    label: 'Unhealthy',
  },
  unknown: {
    icon: AlertCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
    label: 'Unknown',
  },
};

export function HealthDiagnostic({ service, className }: HealthDiagnosticProps) {
  const config = statusConfig[service.status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-lg border p-4',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className={cn('mt-0.5', config.color)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{service.name}</h4>
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
        </div>
        <p className="text-sm text-muted-foreground">{service.message}</p>
        {service.latencyMs !== undefined && (
          <p className="text-xs text-muted-foreground">Response time: {service.latencyMs}ms</p>
        )}
      </div>
    </div>
  );
}

interface HealthOverviewProps {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  title?: string;
  className?: string;
}

export function HealthOverview({ status, title, className }: HealthOverviewProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const messages = {
    healthy: 'All systems operational',
    degraded: 'Some services have issues',
    unhealthy: 'Critical issues detected',
    unknown: 'Unable to determine status',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border p-6',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className={cn(config.color)}>
        <Icon className="h-8 w-8" />
      </div>

      <div>
        <h3 className="text-lg font-semibold">{title || 'System Status'}</h3>
        <p className={cn('text-sm', config.color)}>{messages[status]}</p>
      </div>
    </div>
  );
}
