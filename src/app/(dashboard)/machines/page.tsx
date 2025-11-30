import { MachinesClient } from './machines-client';

export const metadata = {
  title: 'Machines - TailDeck',
  description: 'View and manage your Headscale machines',
};

/**
 * Machines Page
 *
 * Displays all Headscale nodes with filtering, search, and management actions.
 * Actions are role-gated: OPERATOR+ can rename/tag/expire, ADMIN+ can delete.
 */
export default function MachinesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Machines</h1>
        <p className="text-muted-foreground">View and manage your Headscale network nodes.</p>
      </div>
      <MachinesClient />
    </div>
  );
}
