import { z } from 'zod';

/**
 * Zod schemas for validating flow log requests and responses
 */

/**
 * Time range validation
 */
export const timeRangeSchema = z
  .object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((data) => data.start <= data.end, {
    message: 'Start date must be before or equal to end date',
  });

/**
 * IP address validation regex
 */
const ipRegex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

/**
 * Flow query request schema
 */
export const flowQueryRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  start: z.string().datetime().or(z.coerce.date()).optional().nullable(),
  end: z.string().datetime().or(z.coerce.date()).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(100),
  direction: z.enum(['forward', 'backward']).optional().default('backward'),
  sourceIp: z.string().regex(ipRegex, 'Invalid IP address').optional(),
  destinationIp: z.string().regex(ipRegex, 'Invalid IP address').optional(),
  sourceNode: z.string().max(255).optional(),
  destinationNode: z.string().max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  protocol: z.enum(['tcp', 'udp', 'icmp', 'all']).optional(),
  action: z.enum(['accept', 'drop']).optional(),
});

export type FlowQueryRequest = z.infer<typeof flowQueryRequestSchema>;

/**
 * Flow record schema (for response validation)
 */
export const flowRecordSchema = z.object({
  timestamp: z.string(),
  sourceIp: z.string(),
  destinationIp: z.string(),
  sourcePort: z.number().optional(),
  destinationPort: z.number().optional(),
  protocol: z.string(),
  bytes: z.number().optional(),
  packets: z.number().optional(),
  action: z.enum(['accept', 'drop']),
  sourceNode: z.string().optional(),
  destinationNode: z.string().optional(),
  sourceUser: z.string().optional(),
  destinationUser: z.string().optional(),
  raw: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

/**
 * Loki query response schema
 */
export const lokiQueryResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.object({
    resultType: z.enum(['streams', 'vector', 'matrix']),
    result: z.array(
      z.object({
        stream: z.record(z.string(), z.string()),
        values: z.array(z.tuple([z.string(), z.string()])),
      })
    ),
    stats: z.record(z.string(), z.unknown()).optional(),
  }),
  error: z.string().optional(),
});

/**
 * Loki labels response schema
 */
export const lokiLabelsResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.array(z.string()),
});

/**
 * Query validation - prevent dangerous LogQL patterns
 */
export const safeLogQLSchema = z
  .string()
  .min(1)
  .max(10000)
  .refine(
    (query) => {
      // Block potential injection patterns
      const dangerousPatterns = [
        /;\s*drop/i,
        /;\s*delete/i,
        /\|\s*exec/i,
        /\$\{/, // Template injection
      ];
      return !dangerousPatterns.some((pattern) => pattern.test(query));
    },
    { message: 'Query contains potentially dangerous patterns' }
  )
  .refine(
    (query) => {
      // Ensure query starts with a stream selector
      return /^\s*\{/.test(query);
    },
    { message: 'Query must start with a stream selector' }
  );
