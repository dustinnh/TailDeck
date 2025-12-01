'use client';

import { Activity, Network, ScrollText } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { FlowLogsTab } from './flow-logs-tab';
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
        <TabsTrigger value="flow-logs" className="gap-2">
          <ScrollText className="h-4 w-4" />
          Flow Logs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <HealthClient />
      </TabsContent>

      <TabsContent value="topology" className="h-[calc(100vh-280px)] min-h-[500px]">
        <TopologyTab />
      </TabsContent>

      <TabsContent value="flow-logs" className="space-y-6">
        <FlowLogsTab />
      </TabsContent>
    </Tabs>
  );
}
