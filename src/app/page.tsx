import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Home Page
 *
 * Landing page that redirects authenticated users to the dashboard
 * or shows a sign-in prompt for unauthenticated users.
 */
export default async function Home() {
  // Try to check auth status, but don't fail if auth is misconfigured
  let isAuthenticated = false;
  let configError: string | null = null;

  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth();
    isAuthenticated = !!session?.user;
  } catch (error) {
    // Auth is not configured properly - show config error
    configError = error instanceof Error ? error.message : 'Authentication not configured';
  }

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">TailDeck</CardTitle>
          <CardDescription>Headscale Admin Dashboard</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {configError ? (
            <>
              <div className="w-full rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">Configuration Error</p>
                <p className="mt-1">{configError}</p>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Please check your environment variables and restart the server.
              </p>
            </>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">
                Sign in to manage your Headscale mesh VPN network.
              </p>
              <Button asChild className="w-full">
                <Link href="/api/auth/signin">Sign In with Authentik</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
