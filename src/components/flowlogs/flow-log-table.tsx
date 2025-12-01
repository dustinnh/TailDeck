'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { FlowRecord } from '@/lib/api/hooks/use-flowlogs';

interface FlowLogTableProps {
  records: FlowRecord[];
  isLoading?: boolean;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  try {
    // Loki timestamps are in nanoseconds
    const ms = parseInt(timestamp, 10) / 1_000_000;
    const date = new Date(ms);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  try {
    const ms = parseInt(timestamp, 10) / 1_000_000;
    const date = new Date(ms);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Format bytes for display
 */
function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get protocol badge variant
 */
function getProtocolVariant(protocol: string): 'default' | 'secondary' | 'outline' {
  switch (protocol.toLowerCase()) {
    case 'tcp':
      return 'default';
    case 'udp':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Expandable row component
 */
function ExpandableRow({ record }: { record: FlowRecord }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <TableCell className="w-[20px]">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{formatRelativeTime(record.timestamp)}</span>
              </TooltipTrigger>
              <TooltipContent>{formatTimestamp(record.timestamp)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-mono text-xs">{record.sourceIp}</span>
            {record.sourcePort && (
              <span className="text-xs text-muted-foreground">:{record.sourcePort}</span>
            )}
          </div>
          {record.sourceNode && (
            <div className="text-xs text-muted-foreground">{record.sourceNode}</div>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <ArrowDownRight className="h-3.5 w-3.5 text-green-500" />
            <span className="font-mono text-xs">{record.destinationIp}</span>
            {record.destinationPort && (
              <span className="text-xs text-muted-foreground">:{record.destinationPort}</span>
            )}
          </div>
          {record.destinationNode && (
            <div className="text-xs text-muted-foreground">{record.destinationNode}</div>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={getProtocolVariant(record.protocol)} className="text-xs">
            {record.protocol.toUpperCase()}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono text-xs">{formatBytes(record.bytes)}</TableCell>
        <TableCell>
          {record.action === 'accept' ? (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Accept</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-600">
              <Ban className="h-4 w-4" />
              <span className="text-xs">Drop</span>
            </div>
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/50">
          <TableCell colSpan={7}>
            <div className="space-y-3 p-4">
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <div className="font-medium text-muted-foreground">Timestamp</div>
                  <div className="font-mono">{formatTimestamp(record.timestamp)}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">Packets</div>
                  <div>{record.packets ?? '-'}</div>
                </div>
                {record.sourceUser && (
                  <div>
                    <div className="font-medium text-muted-foreground">Source User</div>
                    <div>{record.sourceUser}</div>
                  </div>
                )}
                {record.destinationUser && (
                  <div>
                    <div className="font-medium text-muted-foreground">Destination User</div>
                    <div>{record.destinationUser}</div>
                  </div>
                )}
              </div>

              {/* Labels */}
              {record.labels && Object.keys(record.labels).length > 0 && (
                <div>
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Labels</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(record.labels).map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-xs font-normal">
                        {key}={value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Log */}
              {record.raw && (
                <div>
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Raw Log</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">
                    {record.raw}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function FlowLogTable({ records, isLoading }: FlowLogTableProps) {
  if (records.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No flow logs found</p>
        <p className="text-sm">Try adjusting your search filters or time range</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20px]"></TableHead>
            <TableHead className="w-[120px]">Time</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead className="w-[80px]">Protocol</TableHead>
            <TableHead className="w-[80px] text-right">Bytes</TableHead>
            <TableHead className="w-[80px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <ExpandableRow key={`${record.timestamp}-${index}`} record={record} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
