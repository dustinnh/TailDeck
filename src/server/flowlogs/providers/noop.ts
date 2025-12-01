import 'server-only';

import type { FlowLogProvider } from '../provider';
import type {
  FlowQuery,
  FlowQueryResponse,
  FlowLabelsResponse,
  FlowStatsResponse,
  TimeRange,
} from '../types';

/**
 * No-op Flow Log Provider
 *
 * Used when flow logging is not configured.
 * Returns empty results for all queries.
 */
export class NoopProvider implements FlowLogProvider {
  readonly name = 'noop';

  async query(_query: FlowQuery): Promise<FlowQueryResponse> {
    return {
      records: [],
      hasMore: false,
      stats: { executionTimeMs: 0 },
    };
  }

  async getLabels(_timeRange?: TimeRange): Promise<FlowLabelsResponse> {
    return { labels: [] };
  }

  async getLabelValues(_labelName: string, _timeRange?: TimeRange): Promise<FlowLabelsResponse> {
    return { labels: [] };
  }

  async getStats(_query?: string, _timeRange?: TimeRange): Promise<FlowStatsResponse> {
    return { streams: 0, chunks: 0, entries: 0, bytes: 0 };
  }

  async healthCheck(): Promise<boolean> {
    return true; // Always healthy since it does nothing
  }
}
