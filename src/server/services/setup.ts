/**
 * Setup Service
 *
 * SERVER-ONLY: This file must NEVER be imported by client components.
 * Manages setup completion state and provides setup-related operations.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

import { runDiagnostics, type SystemDiagnostics, type SecurityWarning } from './diagnostics';

// ============================================
// Types
// ============================================

export interface SetupStatus {
  isComplete: boolean;
  completedAt: Date | null;
  completedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  setupVersion: number;
  dismissedWarnings: string[];
}

export interface SetupResult {
  success: boolean;
  error?: string;
}

// ============================================
// Setup Status Functions
// ============================================

/**
 * Get or create system settings
 */
async function getOrCreateSettings() {
  let settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
    include: {
      completedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 'default' },
      include: {
        completedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  return settings;
}

/**
 * Get current setup status
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const settings = await getOrCreateSettings();

  return {
    isComplete: settings.setupCompletedAt !== null,
    completedAt: settings.setupCompletedAt,
    completedBy: settings.completedByUser,
    setupVersion: settings.setupVersion,
    dismissedWarnings: settings.dismissedWarnings,
  };
}

/**
 * Check if setup is complete
 */
export async function isSetupComplete(): Promise<boolean> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
    select: { setupCompletedAt: true },
  });

  return settings?.setupCompletedAt !== null;
}

/**
 * Mark setup as complete
 */
export async function completeSetup(userId: string): Promise<SetupResult> {
  try {
    // Run diagnostics to check for blocking issues
    const diagnostics = await runDiagnostics();

    // Check for critical security warnings
    const criticalWarnings = diagnostics.securityWarnings.filter(
      (w) => w.severity === 'critical' && !w.canDismiss
    );

    if (criticalWarnings.length > 0) {
      return {
        success: false,
        error: `Cannot complete setup: ${criticalWarnings.length} critical issue(s) must be resolved first`,
      };
    }

    // Check for unhealthy services
    if (diagnostics.overall === 'unhealthy') {
      return {
        success: false,
        error: 'Cannot complete setup: One or more services are unhealthy',
      };
    }

    // Update settings - serialize diagnostics to ensure it's plain JSON
    const healthStatusJson = JSON.parse(JSON.stringify(diagnostics));
    await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: {
        setupCompletedAt: new Date(),
        setupCompletedBy: userId,
        lastHealthCheck: new Date(),
        lastHealthStatus: healthStatusJson,
      },
      create: {
        id: 'default',
        setupCompletedAt: new Date(),
        setupCompletedBy: userId,
        lastHealthCheck: new Date(),
        lastHealthStatus: healthStatusJson,
      },
    });

    logger.info({ userId }, 'Setup marked as complete');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, userId }, 'Failed to complete setup');

    return {
      success: false,
      error: `Failed to complete setup: ${message}`,
    };
  }
}

/**
 * Reset setup status (for testing/re-running wizard)
 */
export async function resetSetup(): Promise<SetupResult> {
  try {
    await prisma.systemSettings.update({
      where: { id: 'default' },
      data: {
        setupCompletedAt: null,
        setupCompletedBy: null,
        dismissedWarnings: [],
      },
    });

    logger.info('Setup has been reset');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error }, 'Failed to reset setup');

    return {
      success: false,
      error: `Failed to reset setup: ${message}`,
    };
  }
}

/**
 * Dismiss a security warning
 */
export async function dismissWarning(warningId: string): Promise<SetupResult> {
  try {
    const settings = await getOrCreateSettings();

    // Check if already dismissed
    if (settings.dismissedWarnings.includes(warningId)) {
      return { success: true };
    }

    await prisma.systemSettings.update({
      where: { id: 'default' },
      data: {
        dismissedWarnings: [...settings.dismissedWarnings, warningId],
      },
    });

    logger.info({ warningId }, 'Security warning dismissed');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, warningId }, 'Failed to dismiss warning');

    return {
      success: false,
      error: `Failed to dismiss warning: ${message}`,
    };
  }
}

/**
 * Get filtered security warnings (excluding dismissed)
 */
export async function getActiveWarnings(): Promise<SecurityWarning[]> {
  const [diagnostics, status] = await Promise.all([runDiagnostics(), getSetupStatus()]);

  return diagnostics.securityWarnings.filter((w) => !status.dismissedWarnings.includes(w.id));
}

/**
 * Update health status (called periodically or on demand)
 */
export async function updateHealthStatus(): Promise<SystemDiagnostics> {
  const diagnostics = await runDiagnostics();

  // Serialize diagnostics to ensure it's plain JSON
  const healthStatusJson = JSON.parse(JSON.stringify(diagnostics));
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {
      lastHealthCheck: new Date(),
      lastHealthStatus: healthStatusJson,
    },
    create: {
      id: 'default',
      lastHealthCheck: new Date(),
      lastHealthStatus: healthStatusJson,
    },
  });

  return diagnostics;
}

/**
 * Get cached health status or run fresh diagnostics
 */
export async function getHealthStatus(maxAgeMs: number = 60000): Promise<SystemDiagnostics> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
    select: {
      lastHealthCheck: true,
      lastHealthStatus: true,
    },
  });

  // Check if we have recent cached data
  if (settings?.lastHealthCheck && settings?.lastHealthStatus) {
    const age = Date.now() - settings.lastHealthCheck.getTime();
    if (age < maxAgeMs) {
      return settings.lastHealthStatus as unknown as SystemDiagnostics;
    }
  }

  // Run fresh diagnostics
  return updateHealthStatus();
}
