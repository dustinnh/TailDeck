import { AuditClient } from './audit-client';

export const metadata = {
  title: 'Audit Log - TailDeck',
  description: 'View audit log of all actions in your Headscale network',
};

/**
 * Audit Log Page
 *
 * Displays a searchable, filterable audit log of all actions.
 * Requires AUDITOR role or higher.
 */
export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          View a complete history of actions in your Headscale network.
        </p>
      </div>
      <AuditClient />
    </div>
  );
}
