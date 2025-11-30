import { PoliciesClient } from './policies-client';

export const metadata = {
  title: 'Policies - TailDeck',
  description: 'Edit Headscale ACL policies',
};

/**
 * Policies Page
 *
 * JSON editor for Headscale ACL policies.
 * ADMIN+ only - regular users cannot see this page.
 */
export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ACL Policies</h1>
        <p className="text-muted-foreground">
          Edit Access Control List policies for your Headscale network.
        </p>
      </div>
      <PoliciesClient />
    </div>
  );
}
