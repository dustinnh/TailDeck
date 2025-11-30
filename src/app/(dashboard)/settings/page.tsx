import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { SettingsClient } from './settings-client';

export const metadata = {
  title: 'Settings - TailDeck',
  description: 'Manage TailDeck settings and user roles',
};

/**
 * Settings Page
 *
 * Manage application settings and user roles.
 * ADMIN+ only.
 */
export default async function SettingsPage() {
  const session = await auth();

  // Check if user has ADMIN role
  const userRoles = session?.user?.roles ?? [];
  const isAdmin = userRoles.some((r) => ['ADMIN', 'OWNER'].includes(r));

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage application settings and user roles.</p>
        </div>
        <div className="rounded-lg border p-8 text-center">
          <h2 className="mb-2 text-lg font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You need ADMIN role or higher to access settings.</p>
        </div>
      </div>
    );
  }

  // Fetch users with their roles for the settings page
  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage application settings and user roles.</p>
      </div>
      <SettingsClient
        initialUsers={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
          createdAt: u.createdAt.toISOString(),
          roles: u.userRoles.map((ur) => ({
            name: ur.role.name,
            source: ur.source,
          })),
        }))}
        availableRoles={roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
        }))}
      />
    </div>
  );
}
