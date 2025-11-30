/**
 * Headscale Prometheus Metrics Parser
 *
 * SERVER-ONLY: Fetches and parses Prometheus metrics from Headscale.
 * The metrics endpoint is never exposed to the client (BFF pattern).
 */

import 'server-only';

import { logger } from '@/lib/logger';

/**
 * Parsed Prometheus metric
 */
export interface PrometheusMetric {
  name: string;
  help?: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary' | 'untyped';
  values: Array<{
    labels: Record<string, string>;
    value: number;
  }>;
}

/**
 * Parsed metrics response
 */
export interface ParsedMetrics {
  timestamp: string;
  metrics: Record<string, PrometheusMetric>;
}

/**
 * Key metrics we want to display
 */
export interface HeadscaleMetrics {
  timestamp: string;
  system: {
    goroutines: number;
    heapBytes: number;
    heapObjects: number;
    gcPauseSeconds: number;
    goVersion: string;
  };
  http: {
    totalRequests: number;
    avgLatencyMs: number;
    requestsByPath: Array<{ path: string; count: number; avgLatencyMs: number }>;
  };
  available: boolean;
  error?: string;
}

/**
 * Parse a single metric line from Prometheus format
 */
function parseMetricLine(
  line: string
): { name: string; labels: Record<string, string>; value: number } | null {
  // Skip comments and empty lines
  if (line.startsWith('#') || line.trim() === '') {
    return null;
  }

  // Parse metric line: metric_name{label="value",...} value
  const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?([^}]*)\}?\s+([^\s]+)$/);
  if (!match) {
    // Try without labels: metric_name value
    const simpleMatch = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([^\s]+)$/);
    if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
      return {
        name: simpleMatch[1],
        labels: {},
        value: parseFloat(simpleMatch[2]),
      };
    }
    return null;
  }

  const name = match[1];
  const labelsStr = match[2];
  const valueStr = match[3];

  // Ensure all capture groups matched
  if (!name || !valueStr) {
    return null;
  }

  const labels: Record<string, string> = {};

  // Parse labels using a simpler approach
  if (labelsStr) {
    const labelRegex = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g;
    let labelMatch;
    while ((labelMatch = labelRegex.exec(labelsStr)) !== null) {
      if (labelMatch[1] && labelMatch[2] !== undefined) {
        labels[labelMatch[1]] = labelMatch[2];
      }
    }
  }

  return {
    name,
    labels,
    value: parseFloat(valueStr),
  };
}

/**
 * Parse Prometheus text format to structured data
 */
export function parsePrometheusText(text: string): ParsedMetrics {
  const lines = text.split('\n');
  const metrics: Record<string, PrometheusMetric> = {};

  for (const line of lines) {
    // Parse HELP line
    if (line.startsWith('# HELP ')) {
      const match = line.match(/^# HELP ([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(.*)$/);
      if (match && match[1] && match[2]) {
        const name = match[1];
        const help = match[2];
        if (!metrics[name]) {
          metrics[name] = { name, help, type: 'untyped', values: [] };
        } else {
          metrics[name].help = help;
        }
      }
      continue;
    }

    // Parse TYPE line
    if (line.startsWith('# TYPE ')) {
      const match = line.match(/^# TYPE ([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(\w+)$/);
      if (match && match[1] && match[2]) {
        const name = match[1];
        const type = match[2] as PrometheusMetric['type'];
        if (!metrics[name]) {
          metrics[name] = { name, type, values: [] };
        } else {
          metrics[name].type = type;
        }
      }
      continue;
    }

    // Parse metric value line
    const parsed = parseMetricLine(line);
    if (parsed) {
      // Extract base metric name (remove _bucket, _sum, _count suffixes)
      let baseName = parsed.name;
      if (
        baseName.endsWith('_bucket') ||
        baseName.endsWith('_sum') ||
        baseName.endsWith('_count') ||
        baseName.endsWith('_total')
      ) {
        baseName = baseName.replace(/_(bucket|sum|count|total)$/, '');
      }

      if (!metrics[baseName]) {
        metrics[baseName] = { name: baseName, type: 'untyped', values: [] };
      }

      const metricsEntry = metrics[baseName];
      if (metricsEntry) {
        metricsEntry.values.push({
          labels: { ...parsed.labels, __name__: parsed.name },
          value: parsed.value,
        });
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    metrics,
  };
}

/**
 * Extract key metrics we want to display
 */
export function extractKeyMetrics(parsed: ParsedMetrics): HeadscaleMetrics {
  const metrics = parsed.metrics;

  // System metrics
  const goroutines = metrics['go_goroutines']?.values[0]?.value ?? 0;
  const heapBytes = metrics['go_memstats_heap_alloc_bytes']?.values[0]?.value ?? 0;
  const heapObjects = metrics['go_memstats_heap_objects']?.values[0]?.value ?? 0;

  // GC pause - get the 0.5 quantile (median)
  const gcPauseMetric = metrics['go_gc_duration_seconds'];
  let gcPauseSeconds = 0;
  if (gcPauseMetric) {
    const medianValue = gcPauseMetric.values.find((v) => v.labels['quantile'] === '0.5');
    gcPauseSeconds = medianValue?.value ?? 0;
  }

  // Go version
  const goInfo = metrics['go_info'];
  const goVersion = goInfo?.values[0]?.labels['version'] ?? 'unknown';

  // HTTP metrics - aggregate from histogram
  const httpDuration = metrics['headscale_http_duration_seconds'];
  let totalRequests = 0;
  let totalLatencySum = 0;
  const pathStats = new Map<string, { count: number; sum: number }>();

  if (httpDuration) {
    for (const value of httpDuration.values) {
      const path = value.labels['path'];
      const metricName = value.labels['__name__'];

      if (!path) continue;

      if (!pathStats.has(path)) {
        pathStats.set(path, { count: 0, sum: 0 });
      }

      const stats = pathStats.get(path)!;

      if (metricName === 'headscale_http_duration_seconds_count') {
        stats.count = value.value;
        totalRequests += value.value;
      } else if (metricName === 'headscale_http_duration_seconds_sum') {
        stats.sum = value.value;
        totalLatencySum += value.value;
      }
    }
  }

  // Convert to array
  const requestsByPath: Array<{ path: string; count: number; avgLatencyMs: number }> = [];
  pathStats.forEach((stats, path) => {
    if (stats.count > 0) {
      requestsByPath.push({
        path,
        count: stats.count,
        avgLatencyMs: Math.round((stats.sum / stats.count) * 1000 * 100) / 100,
      });
    }
  });

  // Sort by request count descending
  requestsByPath.sort((a, b) => b.count - a.count);

  const avgLatencyMs =
    totalRequests > 0 ? Math.round((totalLatencySum / totalRequests) * 1000 * 100) / 100 : 0;

  return {
    timestamp: parsed.timestamp,
    system: {
      goroutines,
      heapBytes,
      heapObjects,
      gcPauseSeconds,
      goVersion,
    },
    http: {
      totalRequests,
      avgLatencyMs,
      requestsByPath: requestsByPath.slice(0, 10), // Top 10 paths
    },
    available: true,
  };
}

/**
 * Fetch and parse metrics from Headscale
 */
export async function fetchHeadscaleMetrics(): Promise<HeadscaleMetrics> {
  const metricsUrl = process.env.HEADSCALE_METRICS_URL;

  if (!metricsUrl) {
    return {
      timestamp: new Date().toISOString(),
      system: {
        goroutines: 0,
        heapBytes: 0,
        heapObjects: 0,
        gcPauseSeconds: 0,
        goVersion: 'unknown',
      },
      http: {
        totalRequests: 0,
        avgLatencyMs: 0,
        requestsByPath: [],
      },
      available: false,
      error: 'HEADSCALE_METRICS_URL not configured',
    };
  }

  try {
    const response = await fetch(metricsUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const parsed = parsePrometheusText(text);
    return extractKeyMetrics(parsed);
  } catch (error) {
    logger.error({ error, metricsUrl }, 'Failed to fetch Headscale metrics');

    return {
      timestamp: new Date().toISOString(),
      system: {
        goroutines: 0,
        heapBytes: 0,
        heapObjects: 0,
        gcPauseSeconds: 0,
        goVersion: 'unknown',
      },
      http: {
        totalRequests: 0,
        avgLatencyMs: 0,
        requestsByPath: [],
      },
      available: false,
      error: error instanceof Error ? error.message : 'Failed to fetch metrics',
    };
  }
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
