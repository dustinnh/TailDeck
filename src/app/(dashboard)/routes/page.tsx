import { RoutesClient } from './routes-client';

export const metadata = {
  title: 'Routes - TailDeck',
  description: 'View and manage Headscale subnet routes and exit nodes',
};

/**
 * Routes Page
 *
 * Displays subnet routes and exit nodes with filtering and enable/disable controls.
 * Split view: Exit Nodes tab and Subnet Routes tab.
 */
export default function RoutesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Routes</h1>
        <p className="text-muted-foreground">
          Manage subnet routes and exit nodes in your Headscale network.
        </p>
      </div>
      <RoutesClient />
    </div>
  );
}
