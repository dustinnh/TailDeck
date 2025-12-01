'use client';

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { memo } from 'react';

import { cn } from '@/lib/utils';

/**
 * Data structure for route edges
 * Index signature required for React Flow compatibility
 */
export interface RouteEdgeData extends Record<string, unknown> {
  prefix: string;
  enabled: boolean;
  isPrimary: boolean;
  isExitRoute: boolean;
}

/**
 * Custom route edge with styled path and optional label
 */
export const RouteEdge = memo(function RouteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps & { data?: RouteEdgeData }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const isEnabled = data?.enabled ?? true;
  const isExitRoute = data?.isExitRoute ?? false;
  const isPrimary = data?.isPrimary ?? false;

  // Determine edge styling based on state
  const strokeColor = isExitRoute
    ? 'url(#exit-gradient)'
    : isEnabled
      ? 'hsl(var(--primary))'
      : 'hsl(var(--muted-foreground))';

  const strokeWidth = isPrimary ? 3 : isExitRoute ? 2.5 : 2;
  const strokeDasharray = isEnabled ? undefined : '5 5';

  return (
    <>
      {/* SVG Definitions for gradients */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="exit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
        </defs>
      </svg>

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          opacity: isEnabled ? 1 : 0.5,
        }}
        className={cn(
          'transition-all duration-200',
          isEnabled && !isExitRoute && '[filter:drop-shadow(0_0_3px_hsl(var(--primary)/0.3))]',
          isExitRoute && '[filter:drop-shadow(0_0_4px_rgba(139,92,246,0.4))]',
          selected && 'stroke-[3px]'
        )}
      />

      {/* Edge label showing route prefix */}
      {data?.prefix && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={cn(
              'rounded px-2 py-0.5 font-mono text-[10px]',
              'border bg-background/95 shadow-sm backdrop-blur-sm',
              isEnabled
                ? 'border-primary/30 text-foreground'
                : 'border-muted text-muted-foreground',
              isExitRoute && 'border-violet-500/50 text-violet-600 dark:text-violet-400',
              isPrimary && 'ring-1 ring-primary/30',
              selected && 'ring-2 ring-primary'
            )}
          >
            {data.prefix}
            {isPrimary && <span className="ml-1 text-primary">*</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

RouteEdge.displayName = 'RouteEdge';
