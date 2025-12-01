'use client';

import { Rocket, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface SetupPromptProps {
  isOwner: boolean;
  isSetupComplete: boolean;
}

export function SetupPrompt({ isOwner, isSetupComplete }: SetupPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  // Only show for OWNER role when setup is not complete
  if (!isOwner || isSetupComplete || dismissed) {
    return null;
  }

  return (
    <Alert className="relative border-blue-500/50 bg-blue-500/10">
      <Rocket className="h-4 w-4 text-blue-500" />
      <AlertTitle className="text-blue-700 dark:text-blue-300">Complete TailDeck Setup</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span className="text-muted-foreground">
          Run the setup wizard to verify your configuration and ensure everything is working
          correctly.
        </span>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="ml-4">
            <Link href="/setup">Start Setup</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Server component wrapper that fetches setup status
 * and passes it to the client component
 */
export async function SetupPromptServer({
  isOwner,
  getSetupStatus,
}: {
  isOwner: boolean;
  getSetupStatus: () => Promise<{ isComplete: boolean }>;
}) {
  if (!isOwner) {
    return null;
  }

  try {
    const status = await getSetupStatus();
    return <SetupPrompt isOwner={isOwner} isSetupComplete={status.isComplete} />;
  } catch {
    // If we can't get status, don't show the prompt
    return null;
  }
}
