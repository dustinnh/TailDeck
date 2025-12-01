import pino from 'pino';

/**
 * Paths to redact from logs - prevents accidental secret exposure
 * These patterns match sensitive data across various object structures
 */
const REDACT_PATHS = [
  // Request headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',

  // Response headers
  'res.headers["set-cookie"]',

  // Common secret field names (wildcards match at any depth)
  '*.apiKey',
  '*.api_key',
  '*.apikey',
  '*.password',
  '*.secret',
  '*.token',
  '*.accessToken',
  '*.access_token',
  '*.refreshToken',
  '*.refresh_token',
  '*.idToken',
  '*.id_token',
  '*.privateKey',
  '*.private_key',

  // Environment variable names that might be logged
  '*.HEADSCALE_API_KEY',
  '*.AUTH_SECRET',
  '*.AUTH_AUTHENTIK_SECRET',
  '*.DATABASE_URL',
  '*.LOKI_PASSWORD',

  // Auth.js specific
  '*.credentials',
  '*.csrfToken',
];

/**
 * Create the Pino logger instance with security-focused configuration
 */
function createLogger() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';

  return pino({
    level: logLevel,

    // Redact sensitive fields from all log output
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },

    // Use ISO timestamps for consistency
    timestamp: pino.stdTimeFunctions.isoTime,

    // Format level as string instead of number
    formatters: {
      level: (label) => ({ level: label }),
    },

    // Pretty printing in development
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
  });
}

/**
 * Singleton logger instance
 * Use this throughout the application for consistent logging
 *
 * @example
 * import { logger } from '@/lib/logger';
 *
 * logger.info({ userId: '123' }, 'User logged in');
 * logger.error({ error }, 'Failed to fetch nodes');
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 * Useful for module-specific logging
 *
 * @example
 * const authLogger = createChildLogger({ module: 'auth' });
 * authLogger.info('User authenticated');
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Log an error with proper structure
 * Ensures error objects are serialized correctly
 */
export function logError(error: unknown, message: string, context?: Record<string, unknown>) {
  if (error instanceof Error) {
    logger.error(
      {
        ...context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      },
      message
    );
  } else {
    logger.error({ ...context, error }, message);
  }
}
