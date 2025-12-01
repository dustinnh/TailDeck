'use client';

import { CheckCircle2, ExternalLink, Globe, Lock, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DomainStepProps {
  environment: {
    authUrl: string;
    headscaleUrl: string;
  };
}

export function DomainStep({ environment }: DomainStepProps) {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    authUrl: { verified: boolean; message: string } | null;
    headscaleUrl: { verified: boolean; message: string } | null;
  }>({
    authUrl: null,
    headscaleUrl: null,
  });

  const authUrlIsHttps = environment.authUrl.startsWith('https://');
  const headscaleUrlIsHttps = environment.headscaleUrl.startsWith('https://');

  const verifyUrls = async () => {
    setVerifying(true);

    try {
      // Verify Auth URL
      const authResponse = await fetch('/api/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', value: environment.authUrl }),
      });
      const authResult = await authResponse.json();

      // Verify Headscale URL
      const headscaleResponse = await fetch('/api/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', value: environment.headscaleUrl }),
      });
      const headscaleResult = await headscaleResponse.json();

      setVerificationResult({
        authUrl: authResult,
        headscaleUrl: headscaleResult,
      });
    } catch {
      setVerificationResult({
        authUrl: { verified: false, message: 'Verification failed' },
        headscaleUrl: { verified: false, message: 'Verification failed' },
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Domain Configuration</h1>
        <p className="mt-2 text-muted-foreground">
          Verify your TailDeck and Headscale URLs are configured correctly.
        </p>
      </div>

      {/* TailDeck URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" />
            TailDeck URL
          </CardTitle>
          <CardDescription>The URL where TailDeck is accessible</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              {authUrlIsHttps ? (
                <Lock className="h-4 w-4 text-green-500" />
              ) : (
                <Globe className="h-4 w-4 text-yellow-500" />
              )}
              <code className="text-sm">{environment.authUrl}</code>
            </div>
            <a
              href={environment.authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {!authUrlIsHttps && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
              <div className="text-yellow-500">
                <Lock className="h-4 w-4" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-300">
                  HTTP is not recommended for production
                </p>
                <p className="text-muted-foreground">
                  Configure TLS/HTTPS before deploying to production.
                </p>
              </div>
            </div>
          )}

          {verificationResult.authUrl && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border p-3',
                verificationResult.authUrl.verified
                  ? 'border-green-500/20 bg-green-500/10'
                  : 'border-red-500/20 bg-red-500/10'
              )}
            >
              {verificationResult.authUrl.verified ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">{verificationResult.authUrl.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Headscale URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" />
            Headscale URL
          </CardTitle>
          <CardDescription>The URL where Headscale API is accessible</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              {headscaleUrlIsHttps ? (
                <Lock className="h-4 w-4 text-green-500" />
              ) : (
                <Globe className="h-4 w-4 text-yellow-500" />
              )}
              <code className="text-sm">{environment.headscaleUrl}</code>
            </div>
            <a
              href={environment.headscaleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {verificationResult.headscaleUrl && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border p-3',
                verificationResult.headscaleUrl.verified
                  ? 'border-green-500/20 bg-green-500/10'
                  : 'border-red-500/20 bg-red-500/10'
              )}
            >
              {verificationResult.headscaleUrl.verified ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">{verificationResult.headscaleUrl.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verify Button */}
      <div className="flex justify-center">
        <Button onClick={verifyUrls} disabled={verifying}>
          {verifying ? 'Verifying...' : 'Verify URLs'}
        </Button>
      </div>

      {/* Environment Note */}
      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p>
          These URLs are configured in your{' '}
          <code className="rounded bg-muted px-1">.env.local</code> file. If you need to change
          them, update the file and restart the application.
        </p>
      </div>
    </div>
  );
}
