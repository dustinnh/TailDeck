'use client';

import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Globe, Server, Network } from 'lucide-react';
import { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Data structure for machine nodes in the topology
 * Index signature required for React Flow compatibility
 */
export interface MachineNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  name: string;
  givenName: string;
  ipAddresses: string[];
  online: boolean;
  user: string;
  userId: string;
  isExitNode: boolean;
  isExpiringSoon: boolean;
  routes: Array<{
    id: string;
    prefix: string;
    enabled: boolean;
    isPrimary: boolean;
    isExitRoute: boolean;
  }>;
  lastSeen: Date;
  expiry: Date | null;
  tags: string[];
  machineKey: string;
  registerMethod: string;
}

/**
 * Status indicator dot component
 */
function StatusDot({ status }: { status: 'online' | 'offline' | 'expiring' }) {
  const colorClasses = {
    online: 'bg-emerald-500 shadow-emerald-500/50 shadow-[0_0_8px]',
    offline: 'bg-muted-foreground',
    expiring: 'bg-amber-500 shadow-amber-500/50 shadow-[0_0_8px] animate-pulse',
  };

  return <span className={cn('inline-block h-2.5 w-2.5 rounded-full', colorClasses[status])} />;
}

/**
 * Custom machine node for the network topology
 * MUST be memoized for React Flow performance
 */
export const MachineNode = memo(function MachineNode({
  data,
  selected,
}: NodeProps & { data: MachineNodeData }) {
  const status = !data.online ? 'offline' : data.isExpiringSoon ? 'expiring' : 'online';
  const hasRoutes = data.routes.length > 0;
  const enabledRoutes = data.routes.filter((r) => r.enabled).length;

  return (
    <>
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-primary" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-primary" />

      <div
        className={cn(
          'relative min-w-[200px] max-w-[240px] rounded-xl border-2 bg-card p-3 shadow-lg transition-all duration-200',
          // Online state
          data.online && !data.isExitNode && 'border-emerald-500/50 shadow-emerald-500/10',
          // Offline state
          !data.online && 'border-dashed border-muted-foreground/30 opacity-70',
          // Exit node - always violet regardless of status
          data.isExitNode &&
            data.online &&
            'border-violet-500/60 bg-gradient-to-br from-violet-500/10 via-card to-fuchsia-500/10 shadow-violet-500/20',
          data.isExitNode && !data.online && 'border-violet-500/30',
          // Expiring state
          data.isExpiringSoon && data.online && !data.isExitNode && 'border-amber-500/50',
          // Selected state
          selected && 'scale-105 shadow-xl ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        {/* Exit node badge */}
        {data.isExitNode && (
          <Badge className="absolute -right-2 -top-2.5 bg-violet-500 px-1.5 py-0.5 text-[10px] text-white shadow-lg hover:bg-violet-600">
            EXIT
          </Badge>
        )}

        {/* Header with status and icon */}
        <div className="mb-1.5 flex items-center gap-2">
          <StatusDot status={status} />
          {data.isExitNode ? (
            <Globe className="h-4 w-4 text-violet-500" />
          ) : (
            <Server className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 truncate text-sm font-medium" title={data.label}>
            {data.label}
          </span>
        </div>

        {/* IP Address */}
        <div className="mb-1.5 truncate font-mono text-xs text-muted-foreground">
          {data.ipAddresses[0] || 'No IP'}
        </div>

        {/* Footer with user and routes indicator */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="max-w-[100px] truncate text-muted-foreground" title={data.user}>
            {data.user}
          </span>
          {hasRoutes && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Network className="h-3 w-3" />
              <span>
                {enabledRoutes}/{data.routes.length}
              </span>
            </div>
          )}
        </div>

        {/* Glow effect for online nodes */}
        {data.online && !data.isExitNode && (
          <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 blur-sm" />
        )}
      </div>
    </>
  );
});

MachineNode.displayName = 'MachineNode';
