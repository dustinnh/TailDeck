#!/usr/bin/env npx tsx
/**
 * Authentik Auto-Configuration Script
 *
 * This script automatically configures Authentik for TailDeck:
 * - Creates OAuth2 provider
 * - Creates application
 * - Creates RBAC groups
 *
 * Usage:
 *   npx tsx scripts/setup-authentik.ts
 *
 * Environment variables:
 *   AUTHENTIK_URL - Authentik base URL (default: http://localhost:9000)
 *   AUTHENTIK_BOOTSTRAP_TOKEN - API token for authentication
 *   AUTH_URL - TailDeck URL for redirect URI (default: http://localhost:3000)
 */

import { createAuthentikClient } from '../src/server/authentik/client';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function logError(message: string) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logInfo(message: string) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function logWarn(message: string) {
  console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`);
}

async function main() {
  log('\n========================================', 'green');
  log(' Authentik Auto-Configuration', 'green');
  log('========================================\n', 'green');

  // Get configuration from environment
  const authentikUrl = process.env.AUTHENTIK_URL || 'http://localhost:9000';
  const token = process.env.AUTHENTIK_BOOTSTRAP_TOKEN;
  const authUrl = process.env.AUTH_URL || 'http://localhost:3000';
  const clientId = process.env.AUTH_AUTHENTIK_ID || 'taildeck';

  if (!token) {
    logError('AUTHENTIK_BOOTSTRAP_TOKEN is required');
    log('\nTo set up automatic configuration:');
    log('1. Add AUTHENTIK_BOOTSTRAP_TOKEN to your docker-compose.yml');
    log('2. Run: docker compose up -d');
    log('3. Run this script again\n');
    process.exit(1);
  }

  logInfo(`Authentik URL: ${authentikUrl}`);
  logInfo(`TailDeck URL: ${authUrl}`);
  logInfo(`Client ID: ${clientId}`);
  log('');

  // Create client
  const client = createAuthentikClient(authentikUrl, token);

  // Check health first
  logInfo('Checking Authentik API health...');
  const health = await client.checkHealth();

  if (!health.healthy) {
    logError(`Authentik API is not healthy: ${health.error}`);

    if (!health.apiReachable) {
      log('\nMake sure Authentik is running:');
      log('  docker compose up -d authentik-server');
      log('  docker compose logs -f authentik-server\n');
    }

    process.exit(1);
  }

  logSuccess(`Authentik API is healthy (version: ${health.version || 'unknown'})`);
  log('');

  // Run setup
  const redirectUri = `${authUrl}/api/auth/callback/authentik`;
  logInfo(`Redirect URI: ${redirectUri}`);
  log('');

  logInfo('Setting up TailDeck OAuth2 integration...');
  const result = await client.setupTailDeck(redirectUri, clientId);

  if (!result.success) {
    logError(`Setup failed: ${result.error}`);
    process.exit(1);
  }

  log('');
  logSuccess('Authentik configuration complete!');
  log('');

  // Display results
  log('--- Configuration Summary ---', 'cyan');
  log(`  Provider ID: ${result.providerId}`);
  log(`  Application: ${result.applicationSlug}`);
  log(`  Client ID: ${result.clientId}`);
  log(`  Groups: ${result.groups.join(', ')}`);
  log('');

  if (result.clientSecret) {
    log('┌─────────────────────────────────────────────────────────────┐', 'yellow');
    log('│  IMPORTANT: Save the client secret below!                  │', 'yellow');
    log('│  It will not be shown again.                               │', 'yellow');
    log('└─────────────────────────────────────────────────────────────┘', 'yellow');
    log('');
    log(`AUTH_AUTHENTIK_SECRET=${result.clientSecret}`, 'cyan');
    log('');
    log('Add this to your .env.local file:', 'blue');
    log(`  AUTH_AUTHENTIK_SECRET="${result.clientSecret}"`, 'cyan');
    log('');
  } else {
    logWarn('OAuth2 provider already existed - client secret not regenerated');
    log('If you need a new secret, delete the provider in Authentik and run again.');
    log('');
  }

  log('--- Next Steps ---', 'cyan');
  log('1. Update .env.local with AUTH_AUTHENTIK_SECRET (if new)');
  log('2. Complete Authentik initial setup at:');
  log(`   ${authentikUrl}/if/flow/initial-setup/`, 'cyan');
  log('3. Assign users to groups for role-based access:');
  log('   - TailDeck Admins -> ADMIN role');
  log('   - TailDeck Operators -> OPERATOR role');
  log('   - TailDeck Auditors -> AUDITOR role');
  log('   - TailDeck Users -> USER role');
  log('4. Start TailDeck: npm run dev');
  log('');
}

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
