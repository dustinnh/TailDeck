import type { NextAuthConfig } from 'next-auth';

/**
 * Auth.js configuration that can be used in Edge runtime (middleware)
 * This file should NOT import server-only modules like Prisma
 */
export const authConfig: NextAuthConfig = {
  // Use default Auth.js pages for now
  // Custom pages can be added later if needed

  // Callbacks for authorization logic
  callbacks: {
    /**
     * Controls whether a request is authorized
     * This runs in Edge runtime for middleware
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public paths that don't require authentication
      const publicPaths = ['/', '/signin', '/error'];
      const isPublicPath = publicPaths.some(
        (path) => pathname === path || pathname.startsWith('/api/auth')
      );

      // Protected paths that require authentication
      const isProtectedPath =
        pathname.startsWith('/machines') ||
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/api/headscale');

      // Allow access to public paths
      if (isPublicPath) {
        return true;
      }

      // Protect API routes
      if (pathname.startsWith('/api/') && !isLoggedIn) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Protect dashboard routes
      if (isProtectedPath && !isLoggedIn) {
        const signInUrl = new URL('/api/auth/signin', nextUrl);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return Response.redirect(signInUrl);
      }

      return true;
    },
  },

  // Providers are configured in auth.ts (requires server-only imports)
  providers: [],
};
