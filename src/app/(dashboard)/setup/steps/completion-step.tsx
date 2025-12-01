'use client';

import { ArrowRight, CheckCircle2, FileText, Network, Settings, Shield, Users } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CompletionStepProps {
  onComplete: () => void;
  isCompleting: boolean;
  hasBlockingIssues: boolean;
}

export function CompletionStep({
  onComplete,
  isCompleting,
  hasBlockingIssues,
}: CompletionStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold">Setup Complete!</h1>
        <p className="mt-2 text-muted-foreground">
          Your TailDeck installation is configured and ready to use.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration Summary</CardTitle>
          <CardDescription>Here&apos;s what we verified</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm">Database connection established</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm">Headscale API connected</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm">OIDC authentication configured</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm">MagicDNS enabled</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm">Security review passed</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next Steps</CardTitle>
          <CardDescription>Get started with TailDeck</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/machines"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
            >
              <Network className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Add Machines</p>
                <p className="text-xs text-muted-foreground">Connect your first device</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/policies"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
            >
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Configure ACLs</p>
                <p className="text-xs text-muted-foreground">Set up access policies</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Manage Users</p>
                <p className="text-xs text-muted-foreground">Configure team access</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Settings</p>
                <p className="text-xs text-muted-foreground">Customize TailDeck</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Complete Button */}
      <div className="flex flex-col items-center gap-4">
        <Button size="lg" onClick={onComplete} disabled={isCompleting || hasBlockingIssues}>
          {isCompleting ? 'Completing...' : 'Complete Setup'}
        </Button>

        {hasBlockingIssues && (
          <p className="text-sm text-red-500">
            Please resolve all critical issues before completing setup.
          </p>
        )}
      </div>

      {/* Documentation */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h4 className="font-medium">Need Help?</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Check out the{' '}
              <a
                href="https://headscale.net/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Headscale documentation
              </a>{' '}
              for detailed guides and troubleshooting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
