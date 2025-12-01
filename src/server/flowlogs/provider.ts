import 'server-only';

import type {
  FlowQuery,
  FlowQueryResponse,
  FlowLabelsResponse,
  FlowStatsResponse,
  TimeRange,
} from './types';

/**
 * Abstract interface for flow log providers
 *
 * Implementations must handle:
 * - Query execution with proper timeout handling
 * - Response transformation to normalized FlowRecord format
 * - Error handling with meaningful error messages
 * - Authentication (API keys, basic auth, etc.)
 */
export interface FlowLogProvider {
  /** Provider name for logging/identification */
  readonly name: string;

  /**
   * Query flow logs
   * @param query - The flow query parameters
   * @returns Promise resolving to flow records
   */
  query(query: FlowQuery): Promise<FlowQueryResponse>;

  /**
   * Get available label names
   * @param timeRange - Optional time range to scope the query
   * @returns Promise resolving to label names
   */
  getLabels(timeRange?: TimeRange): Promise<FlowLabelsResponse>;

  /**
   * Get values for a specific label
   * @param labelName - The label to get values for
   * @param timeRange - Optional time range to scope the query
   * @returns Promise resolving to label values
   */
  getLabelValues(labelName: string, timeRange?: TimeRange): Promise<FlowLabelsResponse>;

  /**
   * Get statistics about flow log data
   * @param query - Optional query to scope the stats
   * @param timeRange - Optional time range
   * @returns Promise resolving to statistics
   */
  getStats(query?: string, timeRange?: TimeRange): Promise<FlowStatsResponse>;

  /**
   * Health check for the provider
   * @returns Promise resolving to true if healthy
   */
  healthCheck(): Promise<boolean>;
}
