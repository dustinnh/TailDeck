import 'server-only';

import { logger } from '@/lib/logger';

import type { FlowLogProvider } from '../provider';
import { lokiQueryResponseSchema, lokiLabelsResponseSchema } from '../schemas';
import type {
  FlowQuery,
  FlowQueryResponse,
  FlowRecord,
  FlowLabelsResponse,
  FlowStatsResponse,
  TimeRange,
  LokiConfig,
  LokiQueryResponse,
} from '../types';

/**
 * Custom error class for Loki API errors
 */
export class LokiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'LokiClientError';
  }
}

/**
 * Loki Flow Log Provider
 *
 * Implements the FlowLogProvider interface for Grafana Loki.
 * Uses LogQL for querying and supports multi-tenancy.
 */
export class LokiProvider implements FlowLogProvider {
  readonly name = 'loki';

  private readonly baseUrl: string;
  private readonly tenantId?: string;
  private readonly auth?: { username: string; password: string };
  private readonly timeout: number;

  constructor(config: LokiConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.tenantId = config.tenantId;
    if (config.username && config.password) {
      this.auth = { username: config.username, password: config.password };
    }
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Build headers for Loki requests
   */
  private get headers(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.tenantId) {
      headers['X-Scope-OrgID'] = this.tenantId;
    }

    if (this.auth) {
      const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString(
        'base64'
      );
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }

  /**
   * Make a request to the Loki API
   */
  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      logger.debug({ endpoint, params }, 'Loki API request');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Loki API error: ${response.status}`;
        try {
          const errorBody = (await response.json()) as { error?: string };
          errorMessage = errorBody.error || errorMessage;
        } catch {
          // Ignore JSON parse errors
        }

        logger.error({ statusCode: response.status, endpoint }, `Loki API error: ${errorMessage}`);

        throw new LokiClientError(errorMessage, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LokiClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ endpoint }, 'Loki API request timed out');
        throw new LokiClientError('Request timed out', 504, 'TIMEOUT');
      }

      logger.error({ endpoint, error }, 'Loki API request failed');
      throw new LokiClientError('Failed to connect to Loki', 503, 'CONNECTION_ERROR');
    }
  }

  /**
   * Parse a Loki log line into a FlowRecord
   * This will need customization based on the actual log format from your setup
   */
  private parseLogLine(
    timestamp: string,
    line: string,
    labels: Record<string, string>
  ): FlowRecord {
    // Attempt to parse as JSON first
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      return {
        timestamp,
        sourceIp: String(parsed.src_ip || parsed.source_ip || parsed.srcIP || ''),
        destinationIp: String(parsed.dst_ip || parsed.dest_ip || parsed.dstIP || ''),
        sourcePort: parsed.src_port ? Number(parsed.src_port) : undefined,
        destinationPort: parsed.dst_port ? Number(parsed.dst_port) : undefined,
        protocol: String(parsed.protocol || 'unknown'),
        bytes: parsed.bytes ? Number(parsed.bytes) : undefined,
        packets: parsed.packets ? Number(parsed.packets) : undefined,
        action: (parsed.action === 'drop' ? 'drop' : 'accept') as 'accept' | 'drop',
        sourceNode: parsed.src_node ? String(parsed.src_node) : labels.src_node,
        destinationNode: parsed.dst_node ? String(parsed.dst_node) : labels.dst_node,
        sourceUser: parsed.src_user ? String(parsed.src_user) : undefined,
        destinationUser: parsed.dst_user ? String(parsed.dst_user) : undefined,
        raw: line,
        labels,
      };
    } catch {
      // Fall back to basic record if not JSON
      return {
        timestamp,
        sourceIp: labels.src_ip || 'unknown',
        destinationIp: labels.dst_ip || 'unknown',
        protocol: labels.protocol || 'unknown',
        action: 'accept',
        raw: line,
        labels,
      };
    }
  }

  async query(query: FlowQuery): Promise<FlowQueryResponse> {
    const startTime = Date.now();

    const params: Record<string, string> = {
      query: query.query,
      start: (query.timeRange.start.getTime() * 1_000_000).toString(), // nanoseconds
      end: (query.timeRange.end.getTime() * 1_000_000).toString(),
      limit: (query.limit ?? 100).toString(),
      direction: query.direction ?? 'backward',
    };

    const response = await this.request<LokiQueryResponse>('/loki/api/v1/query_range', params);

    // Validate response
    const validated = lokiQueryResponseSchema.safeParse(response);
    if (!validated.success) {
      logger.error({ errors: validated.error.flatten() }, 'Invalid Loki response');
      throw new LokiClientError('Invalid response from Loki', 500, 'VALIDATION_ERROR');
    }

    // Transform to FlowRecords
    const records: FlowRecord[] = [];
    for (const stream of validated.data.data.result) {
      for (const [timestamp, line] of stream.values) {
        records.push(this.parseLogLine(timestamp, line, stream.stream));
      }
    }

    return {
      records,
      hasMore: records.length >= (query.limit ?? 100),
      stats: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  async getLabels(timeRange?: TimeRange): Promise<FlowLabelsResponse> {
    const params: Record<string, string> = {};
    if (timeRange) {
      params.start = (timeRange.start.getTime() * 1_000_000).toString();
      params.end = (timeRange.end.getTime() * 1_000_000).toString();
    }

    const response = await this.request<{ status: string; data: string[] }>(
      '/loki/api/v1/labels',
      params
    );

    const validated = lokiLabelsResponseSchema.safeParse(response);
    if (!validated.success) {
      throw new LokiClientError('Invalid labels response from Loki', 500);
    }

    return { labels: validated.data.data };
  }

  async getLabelValues(labelName: string, timeRange?: TimeRange): Promise<FlowLabelsResponse> {
    const params: Record<string, string> = {};
    if (timeRange) {
      params.start = (timeRange.start.getTime() * 1_000_000).toString();
      params.end = (timeRange.end.getTime() * 1_000_000).toString();
    }

    const response = await this.request<{ status: string; data: string[] }>(
      `/loki/api/v1/label/${encodeURIComponent(labelName)}/values`,
      params
    );

    const validated = lokiLabelsResponseSchema.safeParse(response);
    if (!validated.success) {
      throw new LokiClientError('Invalid label values response from Loki', 500);
    }

    return { labels: validated.data.data };
  }

  async getStats(_query?: string, _timeRange?: TimeRange): Promise<FlowStatsResponse> {
    // Loki's index stats endpoint requires query parameter
    // For now, return empty stats as this is optional
    return {
      streams: 0,
      chunks: 0,
      entries: 0,
      bytes: 0,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/ready');
      return true;
    } catch {
      return false;
    }
  }
}
