import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { HeadscaleNode } from '@/server/headscale';
import { getHeadscaleClient, HeadscaleClientError } from '@/server/headscale';

/**
 * Format timestamp from Headscale API to human-readable string
 */
function formatTimestamp(timestamp: { seconds: string; nanos: number }): string {
  const ms = parseInt(timestamp.seconds, 10) * 1000 + Math.floor(timestamp.nanos / 1000000);
  const date = new Date(ms);
  return date.toLocaleString();
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: { seconds: string; nanos: number }): string {
  const ms = parseInt(timestamp.seconds, 10) * 1000 + Math.floor(timestamp.nanos / 1000000);
  const now = Date.now();
  const diff = now - ms;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Machine row component
 */
function MachineRow({ node }: { node: HeadscaleNode }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div>
          <div>{node.givenName || node.name}</div>
          {node.givenName && node.givenName !== node.name && (
            <div className="text-xs text-muted-foreground">{node.name}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm">{node.ipAddresses[0] || 'N/A'}</code>
      </TableCell>
      <TableCell>{node.user.name}</TableCell>
      <TableCell>
        <Badge variant={node.online ? 'default' : 'secondary'}>
          {node.online ? 'Online' : 'Offline'}
        </Badge>
      </TableCell>
      <TableCell>
        <span title={formatTimestamp(node.lastSeen)}>{formatRelativeTime(node.lastSeen)}</span>
      </TableCell>
    </TableRow>
  );
}

/**
 * Error display component
 */
function MachinesError({ error }: { error: HeadscaleClientError | Error }) {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Error Loading Machines</CardTitle>
        <CardDescription>
          {error instanceof HeadscaleClientError
            ? `Failed to connect to Headscale (${error.code || error.statusCode})`
            : 'An unexpected error occurred'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Empty state component
 */
function MachinesEmpty() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No Machines Found</CardTitle>
        <CardDescription>
          There are no machines registered in your Headscale network yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Register a new machine using the Headscale CLI or Tailscale client to see it here.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Machines Table (Server Component)
 *
 * Fetches machines from Headscale and displays them in a table.
 * This is an async server component that fetches data on the server.
 */
export async function MachinesTable() {
  try {
    const client = getHeadscaleClient();
    const response = await client.listNodes();

    if (response.nodes.length === 0) {
      return <MachinesEmpty />;
    }

    const onlineCount = response.nodes.filter((n) => n.online).length;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Nodes</CardTitle>
          <CardDescription>
            {response.nodes.length} machine{response.nodes.length !== 1 ? 's' : ''} ({onlineCount}{' '}
            online)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {response.nodes.map((node) => (
                <MachineRow key={node.id} node={node} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  } catch (error) {
    if (error instanceof HeadscaleClientError || error instanceof Error) {
      return <MachinesError error={error} />;
    }
    throw error;
  }
}
