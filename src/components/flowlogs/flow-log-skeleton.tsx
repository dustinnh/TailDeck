'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FlowLogSkeletonProps {
  rows?: number;
}

export function FlowLogSkeleton({ rows = 10 }: FlowLogSkeletonProps) {
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
          {Array.from({ length: rows }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-12" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-14" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function FlowLogQueryBuilderSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {/* First row */}
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="min-w-[140px] flex-1">
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>

      {/* Second row */}
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="min-w-[180px] flex-1">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}
