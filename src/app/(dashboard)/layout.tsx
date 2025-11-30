import { redirect } from 'next/navigation';

import { Header } from '@/components/layout';
import { auth } from '@/lib/auth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard Layout
 *
 * Protected layout for authenticated users.
 * Includes the header with navigation and user info.
 * Redirects unauthenticated users to sign in.
 */
export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-6">{children}</div>
      </main>
    </div>
  );
}
