import { ApiKeysClient } from './api-keys-client';

export const metadata = {
  title: 'API Keys - TailDeck',
  description: 'Manage Headscale API keys',
};

/**
 * API Keys Page
 *
 * Create, list, and manage Headscale API keys.
 * OWNER only - these are sensitive credentials.
 */
export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
        <p className="text-muted-foreground">
          Manage API keys for programmatic access to Headscale.
        </p>
      </div>
      <ApiKeysClient />
    </div>
  );
}
