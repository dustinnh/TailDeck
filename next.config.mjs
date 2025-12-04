/**
 * @type {import('next').NextConfig}
 */

/**
 * Security headers applied to all responses
 * These protect against common web vulnerabilities
 *
 * Note: CSP is set in middleware (src/middleware.ts) so it can use
 * runtime env vars for Authentik origin in Docker deployments
 */
const securityHeaders = [
  // Prevent clickjacking attacks
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevent MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Control referrer information leakage
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Disable browser features we don't use
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // Legacy XSS protection (modern browsers use CSP)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

const nextConfig = {
  // Disable X-Powered-By header (information disclosure)
  poweredByHeader: false,

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Output standalone for Docker deployment
  output: 'standalone',

  // Apply security headers to all routes
  // Note: CSP is set in middleware for runtime env var support
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // Experimental features
  experimental: {
    // Enable typed routes for better type safety
    typedRoutes: true,
  },
};

export default nextConfig;
