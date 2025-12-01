'use client';

import { Search, RefreshCw, Clock } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Time range preset options
 */
const TIME_PRESETS = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
] as const;

/**
 * Protocol filter options
 */
const PROTOCOLS = [
  { value: 'all', label: 'All Protocols' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
] as const;

/**
 * Action filter options
 */
const ACTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'accept', label: 'Accept' },
  { value: 'drop', label: 'Drop' },
] as const;

export interface FlowLogQueryParams {
  query: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  limit: number;
  sourceIp?: string;
  destinationIp?: string;
  protocol?: string;
  action?: string;
}

interface FlowLogQueryBuilderProps {
  onQuery: (params: FlowLogQueryParams) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

/**
 * Calculate time range from preset
 */
function getTimeRangeFromPreset(preset: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case '15m':
      start.setMinutes(end.getMinutes() - 15);
      break;
    case '1h':
      start.setHours(end.getHours() - 1);
      break;
    case '6h':
      start.setHours(end.getHours() - 6);
      break;
    case '24h':
      start.setDate(end.getDate() - 1);
      break;
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    default:
      start.setHours(end.getHours() - 1);
  }

  return { start, end };
}

/**
 * Build LogQL query from filters
 */
function buildLogQLQuery(params: {
  sourceIp?: string;
  destinationIp?: string;
  protocol?: string;
  action?: string;
}): string {
  const selectors: string[] = ['job="tailscale"']; // Base selector for Tailscale flow logs

  if (params.sourceIp) {
    selectors.push(`src_ip="${params.sourceIp}"`);
  }

  if (params.destinationIp) {
    selectors.push(`dst_ip="${params.destinationIp}"`);
  }

  if (params.protocol && params.protocol !== 'all') {
    selectors.push(`protocol="${params.protocol}"`);
  }

  if (params.action && params.action !== 'all') {
    selectors.push(`action="${params.action}"`);
  }

  return `{${selectors.join(', ')}}`;
}

export function FlowLogQueryBuilder({ onQuery, isLoading, onRefresh }: FlowLogQueryBuilderProps) {
  const [timePreset, setTimePreset] = useState('1h');
  const [sourceIp, setSourceIp] = useState('');
  const [destinationIp, setDestinationIp] = useState('');
  const [protocol, setProtocol] = useState('all');
  const [action, setAction] = useState('all');
  const [limit, setLimit] = useState('100');
  const [customQuery, setCustomQuery] = useState('');
  const [useCustomQuery, setUseCustomQuery] = useState(false);

  const handleSearch = useCallback(() => {
    const timeRange = getTimeRangeFromPreset(timePreset);

    const query = useCustomQuery
      ? customQuery
      : buildLogQLQuery({
          sourceIp: sourceIp || undefined,
          destinationIp: destinationIp || undefined,
          protocol,
          action,
        });

    onQuery({
      query,
      timeRange,
      limit: parseInt(limit, 10),
      sourceIp: sourceIp || undefined,
      destinationIp: destinationIp || undefined,
      protocol: protocol !== 'all' ? protocol : undefined,
      action: action !== 'all' ? action : undefined,
    });
  }, [
    timePreset,
    sourceIp,
    destinationIp,
    protocol,
    action,
    limit,
    customQuery,
    useCustomQuery,
    onQuery,
  ]);

  // Run initial query on mount
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {/* Time Range */}
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="time-range" className="mb-2 flex items-center gap-1 text-sm">
            <Clock className="h-3.5 w-3.5" />
            Time Range
          </Label>
          <Select value={timePreset} onValueChange={setTimePreset}>
            <SelectTrigger id="time-range">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px] flex-1">
          <Label htmlFor="protocol" className="mb-2 block text-sm">
            Protocol
          </Label>
          <Select value={protocol} onValueChange={setProtocol}>
            <SelectTrigger id="protocol">
              <SelectValue placeholder="Protocol" />
            </SelectTrigger>
            <SelectContent>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px] flex-1">
          <Label htmlFor="action" className="mb-2 block text-sm">
            Action
          </Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="action">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[100px] max-w-[120px] flex-1">
          <Label htmlFor="limit" className="mb-2 block text-sm">
            Limit
          </Label>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger id="limit">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500</SelectItem>
              <SelectItem value="1000">1000</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* IP Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="source-ip" className="mb-2 block text-sm">
            Source IP
          </Label>
          <Input
            id="source-ip"
            type="text"
            placeholder="e.g., 100.64.0.1"
            value={sourceIp}
            onChange={(e) => setSourceIp(e.target.value)}
          />
        </div>

        <div className="min-w-[180px] flex-1">
          <Label htmlFor="dest-ip" className="mb-2 block text-sm">
            Destination IP
          </Label>
          <Input
            id="dest-ip"
            type="text"
            placeholder="e.g., 100.64.0.2"
            value={destinationIp}
            onChange={(e) => setDestinationIp(e.target.value)}
          />
        </div>
      </div>

      {/* Custom Query Toggle */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-custom"
            checked={useCustomQuery}
            onChange={(e) => setUseCustomQuery(e.target.checked)}
            className="rounded border-gray-300"
          />
          <Label htmlFor="use-custom" className="cursor-pointer text-sm font-normal">
            Use custom LogQL query
          </Label>
        </div>

        {useCustomQuery && (
          <Input
            type="text"
            placeholder='{job="tailscale"} |= "error"'
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            className="font-mono text-sm"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSearch} disabled={isLoading} className="gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>

        {onRefresh && (
          <Button variant="outline" onClick={onRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}
