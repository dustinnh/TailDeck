import { DNSClient } from './dns-client';

export const metadata = {
  title: 'DNS Settings - TailDeck',
  description: 'Configure DNS settings for your Headscale network',
};

/**
 * DNS Settings Page
 *
 * Configure nameservers, search domains, and MagicDNS.
 * ADMIN+ only.
 */
export default function DNSPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">DNS Settings</h1>
        <p className="text-muted-foreground">
          Configure DNS nameservers, search domains, and MagicDNS for your network.
        </p>
      </div>
      <DNSClient />
    </div>
  );
}
