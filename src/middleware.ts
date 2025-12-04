import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';

import { authConfig } from '@/lib/auth.config';

/**
 * Get Authentik origin for CSP form-action
 * Must be computed at runtime (not build time) for Docker deployments
 */
function getAuthentikOrigin(): string {
  const issuer = process.env.AUTH_AUTHENTIK_ISSUER;
  if (issuer) {
    try {
      return new URL(issuer).origin;
    } catch {
      // Invalid URL, fall back to default
    }
  }
  return 'http://localhost:9000';
}

/**
 * Build CSP header with runtime Authentik origin
 * This must be in middleware (not next.config.mjs) so it uses
 * runtime env vars instead of build-time placeholders
 */
function buildCspHeader(): string {
  return `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://authjs.dev;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self' ${getAuthentikOrigin()};
    frame-ancestors 'none';
  `
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Auth.js middleware for route protection
 *
 * This middleware runs on every request and:
 * 1. Checks if the user is authenticated
 * 2. Redirects to signin for protected routes
 * 3. Adds request tracing headers
 * 4. Sets CSP header with runtime Authentik origin
 *
 * Note: This uses authConfig (not auth) because middleware
 * runs in Edge runtime and cannot use Prisma adapter
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Add request ID for tracing
  const requestId = crypto.randomUUID();

  // Log request in development
  if (process.env.NODE_ENV === 'development') {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    console.log(
      `[${requestId.slice(0, 8)}] ${req.method} ${req.nextUrl.pathname} - IP: ${clientIp} - Auth: ${!!req.auth}`
    );
  }

  // Continue to the page with headers
  const response = NextResponse.next();
  response.headers.set('X-Request-ID', requestId);

  // Set CSP header with runtime Authentik origin
  response.headers.set('Content-Security-Policy', buildCspHeader());

  return response;
});

/**
 * Matcher configuration
 * Determines which routes the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
