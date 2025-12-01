'use client';

import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Server } from 'lucide-react';
import { memo } from 'react';

import { cn } from '@/lib/utils';

/**
 * Data structure for the Headscale server node in the topology
 * Index signature required for React Flow compatibility
 */
export interface HeadscaleNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  online: boolean;
  url?: string;
  nodeCount: number;
  userCount: number;
}

/**
 * Custom Headscale server node for the network topology
 * Displayed as the central coordination server
 * MUST be memoized for React Flow performance
 */
export const HeadscaleNode = memo(function HeadscaleNode({
  data,
  selected,
}: NodeProps & { data: HeadscaleNodeData }) {
  return (
    <>
      {/* Connection handle - only source since nodes connect to it */}
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-blue-500" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-blue-500" />

      <div
        className={cn(
          'relative min-w-[180px] max-w-[220px] rounded-xl border-2 bg-card p-4 shadow-lg transition-all duration-200',
          // Always use blue theme for Headscale server
          data.online
            ? 'border-blue-500/60 bg-gradient-to-br from-blue-500/10 via-card to-cyan-500/10 shadow-blue-500/20'
            : 'border-blue-500/30 opacity-70',
          // Selected state
          selected && 'scale-105 shadow-xl ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        {/* Server icon and status */}
        <div className="mb-2 flex items-center justify-center gap-2">
          <div className="relative">
            <Server className="h-8 w-8 text-blue-500" />
            {/* Status indicator */}
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card',
                data.online
                  ? 'bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/50'
                  : 'bg-muted-foreground'
              )}
            />
          </div>
        </div>

        {/* Label */}
        <div className="mb-2 text-center">
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {data.label}
          </span>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex flex-col items-center">
            <span className="font-medium text-foreground">{data.nodeCount}</span>
            <span>nodes</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-medium text-foreground">{data.userCount}</span>
            <span>users</span>
          </div>
        </div>

        {/* Glow effect for online state */}
        {data.online && (
          <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 blur-md" />
        )}
      </div>
    </>
  );
});

HeadscaleNode.displayName = 'HeadscaleNode';
