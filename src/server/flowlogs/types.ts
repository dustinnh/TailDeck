/**
 * Flow Log Type Definitions
 *
 * SERVER-ONLY: These types are used for flow log provider implementations.
 */

/**
 * Supported flow log provider types
 */
export type FlowLogProviderType = 'loki' | 'elasticsearch' | 'clickhouse' | 'noop';

/**
 * Time range for queries
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Direction of log sorting
 */
export type SortDirection = 'forward' | 'backward';

/**
 * Query parameters for flow logs
 */
export interface FlowQuery {
  /** LogQL query string (for Loki) or equivalent for other providers */
  query: string;
  /** Time range for the query */
  timeRange: TimeRange;
  /** Maximum number of results to return */
  limit?: number;
  /** Sort direction (default: backward - newest first) */
  direction?: SortDirection;
  /** Filter by source IP */
  sourceIp?: string;
  /** Filter by destination IP */
  destinationIp?: string;
  /** Filter by source node name */
  sourceNode?: string;
  /** Filter by destination node name */
  destinationNode?: string;
  /** Filter by port */
  port?: number;
  /** Filter by protocol (tcp, udp, icmp) */
  protocol?: string;
  /** Filter by action (accept, drop) */
  action?: 'accept' | 'drop';
}

/**
 * Individual flow log record
 */
export interface FlowRecord {
  /** Timestamp in nanoseconds (Unix epoch) */
  timestamp: string;
  /** Source IP address */
  sourceIp: string;
  /** Destination IP address */
  destinationIp: string;
  /** Source port (if applicable) */
  sourcePort?: number;
  /** Destination port (if applicable) */
  destinationPort?: number;
  /** Protocol (tcp, udp, icmp, etc.) */
  protocol: string;
  /** Bytes transferred */
  bytes?: number;
  /** Packets transferred */
  packets?: number;
  /** Action taken (accept, drop) */
  action: 'accept' | 'drop';
  /** Source node name (if resolved) */
  sourceNode?: string;
  /** Destination node name (if resolved) */
  destinationNode?: string;
  /** Source user/namespace (if resolved) */
  sourceUser?: string;
  /** Destination user/namespace (if resolved) */
  destinationUser?: string;
  /** Raw log line */
  raw?: string;
  /** Additional labels from the log stream */
  labels?: Record<string, string>;
}

/**
 * Response from a flow log query
 */
export interface FlowQueryResponse {
  /** Array of flow records */
  records: FlowRecord[];
  /** Total count (if available) */
  total?: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Query statistics */
  stats?: {
    /** Query execution time in ms */
    executionTimeMs: number;
    /** Bytes scanned */
    bytesScanned?: number;
    /** Entries scanned */
    entriesScanned?: number;
  };
}

/**
 * Label values response
 */
export interface FlowLabelsResponse {
  /** Available label names or values */
  labels: string[];
}

/**
 * Statistics about flow log data
 */
export interface FlowStatsResponse {
  /** Number of log streams */
  streams: number;
  /** Number of chunks */
  chunks: number;
  /** Total entries */
  entries: number;
  /** Total bytes */
  bytes: number;
}

/**
 * Configuration for the Loki provider
 */
export interface LokiConfig {
  /** Loki API URL */
  url: string;
  /** Tenant ID for multi-tenancy (X-Scope-OrgID header) */
  tenantId?: string;
  /** Basic auth username */
  username?: string;
  /** Basic auth password */
  password?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Loki API response types
 */
export interface LokiQueryResponse {
  status: 'success' | 'error';
  data: {
    resultType: 'streams' | 'vector' | 'matrix';
    result: LokiStream[];
    stats?: Record<string, unknown>;
  };
  error?: string;
}

export interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][]; // [timestamp_ns, log_line]
}
