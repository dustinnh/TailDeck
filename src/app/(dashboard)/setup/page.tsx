import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { SetupWizardClient } from './setup-wizard-client';

export const metadata = {
  title: 'Setup Wizard | TailDeck',
  description: 'Complete your TailDeck installation setup',
};

export default async function SetupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/');
  }

  // Check for OWNER role
  const userRoles = (session.user as { roles?: string[] }).roles || [];
  const isOwner = userRoles.includes('OWNER');

  if (!isOwner) {
    redirect('/dashboard');
  }

  return (
    <div className="container max-w-4xl py-8">
      <SetupWizardClient />
    </div>
  );
}
