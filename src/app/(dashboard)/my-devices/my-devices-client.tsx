'use client';

import { formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNodes, type Node } from '@/lib/api/hooks/use-nodes';

function formatTimestamp(timestamp: { seconds: string; nanos: number }): Date {
  const ms = parseInt(timestamp.seconds, 10) * 1000 + Math.floor(timestamp.nanos / 1000000);
  return new Date(ms);
}

export function MyDevicesClient() {
  const { data: session } = useSession();
  const { data: nodes, isLoading, error, refetch } = useNodes();
  const [showGetStarted, setShowGetStarted] = useState(false);

  // Get current user's email to filter devices
  const userEmail = session?.user?.email;

  if (isLoading) {
    return <MyDevicesSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Devices</CardTitle>
          <CardDescription>Failed to connect to Headscale</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // Filter to show only devices that might belong to the current user
  // This is a basic implementation - in production, you'd have better user-device mapping
  const myDevices =
    nodes?.filter((node) => {
      // Match by user name containing the email prefix
      const emailPrefix = userEmail?.split('@')[0]?.toLowerCase();
      return (
        emailPrefix &&
        (node.user.name.toLowerCase().includes(emailPrefix) ||
          node.givenName?.toLowerCase().includes(emailPrefix) ||
          node.name.toLowerCase().includes(emailPrefix))
      );
    }) ?? [];

  if (myDevices.length === 0 && !showGetStarted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Devices Found</CardTitle>
          <CardDescription>
            You don&apos;t have any devices connected to the network yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect a device to see it here. If you already have devices, they may be registered
            under a different user.
          </p>
          <Button onClick={() => setShowGetStarted(true)}>Get Started</Button>
        </CardContent>
      </Card>
    );
  }

  if (showGetStarted || myDevices.length === 0) {
    return <GetStartedGuide onClose={() => setShowGetStarted(false)} />;
  }

  const onlineCount = myDevices.filter((n) => n.online).length;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myDevices.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {myDevices.length - onlineCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Devices</CardTitle>
                <CardDescription>Devices associated with your account</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowGetStarted(true)}>
                  Add Device
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myDevices.map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function DeviceCard({ device }: { device: Node }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-4">
        <div className={`h-3 w-3 rounded-full ${device.online ? 'bg-green-500' : 'bg-gray-300'}`} />
        <div>
          <div className="font-medium">{device.givenName || device.name}</div>
          <div className="text-sm text-muted-foreground">
            <code>{device.ipAddresses[0]}</code>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <Badge variant={device.online ? 'default' : 'secondary'}>
            {device.online ? 'Online' : 'Offline'}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-1 cursor-help text-xs text-muted-foreground">
                {formatDistanceToNow(formatTimestamp(device.lastSeen), {
                  addSuffix: true,
                })}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              Last seen: {formatTimestamp(device.lastSeen).toLocaleString()}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function GetStartedGuide({ onClose }: { onClose: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Get Started with Tailscale</CardTitle>
            <CardDescription>Follow these steps to connect your first device</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1 */}
        <div className="flex gap-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            1
          </div>
          <div>
            <h3 className="font-medium">Install Tailscale</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Download and install the Tailscale client for your device.
            </p>
            <a
              href="https://tailscale.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Download Tailscale →
            </a>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            2
          </div>
          <div>
            <h3 className="font-medium">Get an Auth Key</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask an administrator to generate an auth key for you, or use the Add Device page if
              you have OPERATOR permissions.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            3
          </div>
          <div>
            <h3 className="font-medium">Connect</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run the following command with your auth key:
            </p>
            <div className="mt-2 rounded-md bg-muted p-3 font-mono text-sm">
              tailscale up --login-server YOUR_SERVER --authkey YOUR_KEY
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex gap-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            4
          </div>
          <div>
            <h3 className="font-medium">Verify Connection</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Once connected, your device will appear in this list. You can check the connection
              status using:
            </p>
            <div className="mt-2 rounded-md bg-muted p-3 font-mono text-sm">tailscale status</div>
          </div>
        </div>

        {/* Help */}
        <div className="rounded-lg bg-muted p-4">
          <h4 className="font-medium">Need Help?</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact your administrator or check the{' '}
            <a
              href="https://headscale.net/usage/connect/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Headscale documentation
            </a>{' '}
            for more detailed instructions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MyDevicesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
