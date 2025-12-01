'use client';

import { Panel } from '@xyflow/react';
import { Info, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Collapsible legend showing topology visual elements
 */
export function TopologyLegend() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <Panel position="bottom-left" className="m-4">
        <Button
          variant="outline"
          size="icon"
          className="bg-card shadow-lg"
          onClick={() => setCollapsed(false)}
        >
          <Info className="h-4 w-4" />
        </Button>
      </Panel>
    );
  }

  return (
    <Panel position="bottom-left" className="m-4">
      <Card className="w-52 shadow-lg">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Legend</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCollapsed(true)}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-3 pt-0 text-xs">
          {/* Node Types */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Nodes
            </p>
            <LegendNodeItem color="emerald" label="Online" />
            <LegendNodeItem color="gray" label="Offline" dashed />
            <LegendNodeItem color="amber" label="Expiring Soon" pulse />
            <LegendNodeItem color="violet" label="Exit Node" gradient />
          </div>

          {/* Edge Types */}
          <div className="space-y-2 border-t pt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Routes
            </p>
            <LegendEdgeItem color="primary" label="Enabled Route" />
            <LegendEdgeItem color="gray" label="Disabled Route" dashed />
            <LegendEdgeItem color="violet" label="Exit Route" />
          </div>
        </CardContent>
      </Card>
    </Panel>
  );
}

/**
 * Legend node item
 */
function LegendNodeItem({
  color,
  label,
  dashed,
  pulse,
  gradient,
}: {
  color: 'emerald' | 'gray' | 'amber' | 'violet';
  label: string;
  dashed?: boolean;
  pulse?: boolean;
  gradient?: boolean;
}) {
  const colorClasses = {
    emerald: 'border-emerald-500 bg-emerald-500/10',
    gray: 'border-gray-400',
    amber: 'border-amber-500 bg-amber-500/10',
    violet: 'border-violet-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-3.5 w-5 rounded border-2',
          colorClasses[color],
          dashed && 'border-dashed bg-transparent',
          pulse && 'animate-pulse',
          gradient && 'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20'
        )}
      />
      <span className="text-foreground">{label}</span>
    </div>
  );
}

/**
 * Legend edge item
 */
function LegendEdgeItem({
  color,
  label,
  dashed,
}: {
  color: 'primary' | 'gray' | 'violet';
  label: string;
  dashed?: boolean;
}) {
  const colorClasses = {
    primary: 'bg-primary',
    gray: 'bg-muted-foreground',
    violet: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-0.5 w-6 rounded-full',
          dashed
            ? 'border-t-2 border-dashed border-muted-foreground bg-transparent'
            : colorClasses[color]
        )}
      />
      <span className="text-foreground">{label}</span>
    </div>
  );
}
