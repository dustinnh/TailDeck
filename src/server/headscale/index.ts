/**
 * Headscale API module exports
 *
 * SERVER-ONLY: This module should only be imported in server components
 * or API routes. Never import in client components.
 */

export { getHeadscaleClient, HeadscaleClientError } from './client';
export * from './types';
export * from './schemas';
