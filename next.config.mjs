/**
 * @type {import('next').NextConfig}
 */

/**
 * Security headers applied to all responses
 * These protect against common web vulnerabilities
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

/**
 * Content Security Policy
 * Controls which resources can be loaded
 *
 * Note: 'unsafe-inline' and 'unsafe-eval' are needed for Next.js development
 * These should be tightened in production with nonces/hashes
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://authjs.dev;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self' http://localhost:9000;
  frame-ancestors 'none';
`
  .replace(/\s{2,}/g, ' ')
  .trim();

const nextConfig = {
  // Disable X-Powered-By header (information disclosure)
  poweredByHeader: false,

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Output standalone for Docker deployment
  output: 'standalone',

  // Apply security headers to all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          ...securityHeaders,
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
        ],
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
