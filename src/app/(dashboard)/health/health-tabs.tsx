'use client';

import { Activity, Network } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { HealthClient } from './health-client';
import { TopologyTab } from './topology-tab';

export function HealthTabs() {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview" className="gap-2">
          <Activity className="h-4 w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="topology" className="gap-2">
          <Network className="h-4 w-4" />
          Network Topology
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <HealthClient />
      </TabsContent>

      <TabsContent value="topology" className="h-[calc(100vh-280px)] min-h-[500px]">
        <TopologyTab />
      </TabsContent>
    </Tabs>
  );
}
