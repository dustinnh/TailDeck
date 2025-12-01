import type { Metadata } from 'next';

import { FlowLogsClient } from './flow-logs-client';

export const metadata: Metadata = {
  title: 'Flow Logs - TailDeck',
  description: 'Network traffic flow logs and analysis',
};

export default function FlowLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Flow Logs</h1>
        <p className="text-muted-foreground">
          View and analyze network traffic flow logs from your Tailscale network
        </p>
      </div>
      <FlowLogsClient />
    </div>
  );
}
