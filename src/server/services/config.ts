/**
 * Public Configuration Service
 *
 * SERVER-ONLY: This file must NEVER be imported by client components.
 * Provides configuration values that are safe to expose to the browser.
 */

export interface PublicConfig {
  headscaleUrl: string;
  magicDnsEnabled: boolean;
  magicDnsDomain?: string;
}

/**
 * Get configuration values safe to expose to clients
 */
export function getPublicConfig(): PublicConfig {
  return {
    headscaleUrl: process.env.HEADSCALE_URL || 'http://localhost:8080',
    magicDnsEnabled: true, // TODO: Get from Headscale config when available
    magicDnsDomain: process.env.MAGIC_DNS_DOMAIN || 'taildeck.local',
  };
}
