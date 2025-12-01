'use client';

import { Suspense } from 'react';

import { NetworkTopology } from '@/components/topology';
import { Skeleton } from '@/components/ui/skeleton';

function TopologySkeleton() {
  return <Skeleton className="h-full min-h-[500px] w-full rounded-lg" />;
}

export function TopologyTab() {
  return (
    <Suspense fallback={<TopologySkeleton />}>
      <NetworkTopology className="h-full" />
    </Suspense>
  );
}
