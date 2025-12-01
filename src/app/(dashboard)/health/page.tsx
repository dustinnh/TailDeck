import type { Metadata } from 'next';

import { HealthTabs } from './health-tabs';

export const metadata: Metadata = {
  title: 'Health - TailDeck',
  description: 'Network health and connectivity status',
};

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Health</h1>
        <p className="text-muted-foreground">Network health and connectivity status</p>
      </div>
      <HealthTabs />
    </div>
  );
}
