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

import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Update a value in .env.local file
 * Creates the file if it doesn't exist, updates the value if it does
 */
function updateEnvFile(key: string, value: string): boolean {
  const envPath = path.join(process.cwd(), '.env.local');

  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
    }

    const lines = content.split('\n');
    let found = false;

    // Look for the key and update it
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match the key at the start of line (with optional quotes)
      if (line && line.match(new RegExp(`^${key}=`))) {
        lines[i] = `${key}="${value}"`;
        found = true;
        break;
      }
    }

    // If not found, append it
    if (!found) {
      // Add a newline if the file doesn't end with one
      if (content.length > 0 && !content.endsWith('\n')) {
        lines.push('');
      }
      lines.push(`${key}="${value}"`);
    }

    fs.writeFileSync(envPath, lines.join('\n'));
    return true;
  } catch (error) {
    logError(`Failed to update .env.local: ${error instanceof Error ? error.message : error}`);
    return false;
  }
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

  // Wait for Authentik API to be ready
  // The bootstrap token is created by blueprints, which can take 30-90 seconds
  // on first startup (especially on lower-end VPS systems)
  logInfo('Waiting for Authentik API and blueprints to be ready...');
  logInfo('(This may take up to 2 minutes on first startup)');

  const health = await client.waitForApiReady(60, 2000, (attempt, max, status) => {
    // Show progress every 5 attempts (10 seconds)
    if (attempt % 5 === 0) {
      log(`  ${status}`);
    }
  });

  if (!health.healthy) {
    logError(`Authentik API is not ready: ${health.error}`);

    if (!health.apiReachable) {
      log('\nMake sure Authentik is running:');
      log('  docker compose up -d authentik-server');
      log('  docker compose logs -f authentik-server\n');
    } else if (health.error?.includes('Token invalid/expired')) {
      log('\nThe bootstrap token was not accepted. This can happen if:');
      log('  - The AUTHENTIK_BOOTSTRAP_TOKEN in .env does not match what Authentik has stored');
      log('  - The Authentik database was initialized with a different token');
      log('\nTo fix this, you can:');
      log('  1. Run ./scripts/cleanup.sh to reset everything');
      log('  2. Run ./scripts/setup.sh again with a fresh setup\n');
    }

    process.exit(1);
  }

  logSuccess(`Authentik API is ready (version: ${health.version || 'unknown'})`);
  log('');

  // Wait for flows to be available (blueprints apply them)
  logInfo('Verifying OAuth2 flows are available...');

  const flowsReady = await client.waitForFlowsReady(15, 2000, (attempt, max) => {
    // Show progress every 5 attempts (10 seconds)
    if (attempt % 5 === 0) {
      log(`  Still waiting for flows... (${attempt}/${max})`);
    }
  });

  if (!flowsReady) {
    logError('OAuth2 authorization flows not found');
    log('\nThe authorization flow was not found after waiting.');
    log('This can happen if:');
    log('  - Authentik blueprints are corrupted');
    log('  - There is a problem with Authentik configuration\n');
    log('Try running: docker compose logs authentik-worker');
    process.exit(1);
  }

  logSuccess('OAuth2 flows verified');
  log('');

  // Wait for scope mappings to be available (also created by blueprints)
  logInfo('Verifying OAuth2 scope mappings are available...');

  const scopesReady = await client.waitForScopeMappingsReady(15, 2000, (attempt, max) => {
    // Show progress every 5 attempts (10 seconds)
    if (attempt % 5 === 0) {
      log(`  Still waiting for scope mappings... (${attempt}/${max})`);
    }
  });

  if (!scopesReady) {
    logError('OAuth2 scope mappings not found');
    log('\nThe OIDC scope mappings were not found after waiting.');
    log('This can happen if:');
    log('  - Authentik blueprints are corrupted');
    log('  - There is a problem with Authentik configuration\n');
    log('Try running: docker compose logs authentik-worker');
    process.exit(1);
  }

  logSuccess('OAuth2 scope mappings verified');
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
    // Automatically update .env.local with the new client secret
    if (updateEnvFile('AUTH_AUTHENTIK_SECRET', result.clientSecret)) {
      logSuccess('Updated AUTH_AUTHENTIK_SECRET in .env.local');
      log('');
      log('┌─────────────────────────────────────────────────────────────┐', 'green');
      log('│  Client secret has been saved to .env.local                │', 'green');
      log('│  No manual configuration needed!                           │', 'green');
      log('└─────────────────────────────────────────────────────────────┘', 'green');
      log('');
    } else {
      // Fallback to manual instructions if auto-update fails
      log('┌─────────────────────────────────────────────────────────────┐', 'yellow');
      log('│  IMPORTANT: Save the client secret below!                  │', 'yellow');
      log('│  It will not be shown again.                               │', 'yellow');
      log('└─────────────────────────────────────────────────────────────┘', 'yellow');
      log('');
      log('Add this to your .env.local file:', 'blue');
      log(`  AUTH_AUTHENTIK_SECRET="${result.clientSecret}"`, 'cyan');
      log('');
    }
  } else {
    // This should not happen with the current setup logic, but just in case
    logError('No client secret was generated - this is unexpected');
    log('Please check the Authentik configuration and try again.');
    log('');
  }

  log('--- Next Steps ---', 'cyan');
  log('1. Complete Authentik initial setup at:');
  log(`   ${authentikUrl}/if/flow/initial-setup/`, 'cyan');
  log('2. Assign users to groups for role-based access:');
  log('   - TailDeck Admins -> ADMIN role');
  log('   - TailDeck Operators -> OPERATOR role');
  log('   - TailDeck Auditors -> AUDITOR role');
  log('   - TailDeck Users -> USER role');
  log('3. Start TailDeck: npm run dev');
  log('');
}

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
