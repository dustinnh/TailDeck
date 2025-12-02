/**
 * NetFlow Data API
 *
 * Returns network flow data collected by GoFlow2.
 * GoFlow2 writes JSON flow records to a file that we read and serve.
 */

import { existsSync, readFileSync, statSync } from 'fs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { withMinimumRole } from '@/server/middleware/require-role';

export const dynamic = 'force-dynamic';

// GoFlow2 writes flows to this file
const FLOWS_FILE = process.env.GOFLOW_DATA_PATH || '/flows/flows.json';

interface FlowRecord {
  Type: string;
  TimeReceived: number;
  SequenceNum: number;
  SamplingRate: number;
  SamplerAddress: string;
  TimeFlowStart: number;
  TimeFlowEnd: number;
  Bytes: number;
  Packets: number;
  SrcAddr: string;
  DstAddr: string;
  Etype: number;
  Proto: number;
  SrcPort: number;
  DstPort: number;
  InIf: number;
  OutIf: number;
  SrcMac: string;
  DstMac: string;
  SrcAS: number;
  DstAS: number;
  TCPFlags: number;
  // Parsed fields we add
  protoName?: string;
  srcAddrDisplay?: string;
  dstAddrDisplay?: string;
}

/**
 * Protocol number to name mapping
 */
const PROTOCOL_NAMES: Record<number, string> = {
  1: 'ICMP',
  6: 'TCP',
  17: 'UDP',
  47: 'GRE',
  50: 'ESP',
  51: 'AH',
  58: 'ICMPv6',
  89: 'OSPF',
  132: 'SCTP',
};

/**
 * Read last N lines from a file efficiently
 */
function readLastLines(filePath: string, lineCount: number): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  return lines.slice(-lineCount);
}

/**
 * Parse and enrich a flow record
 */
function parseFlow(line: string): FlowRecord | null {
  try {
    const flow = JSON.parse(line) as FlowRecord;
    flow.protoName = PROTOCOL_NAMES[flow.Proto] || `Proto-${flow.Proto}`;
    return flow;
  } catch {
    return null;
  }
}

/**
 * GET /api/flows
 *
 * Query params:
 * - limit: Number of flows to return (default: 100, max: 1000)
 * - src: Filter by source IP
 * - dst: Filter by destination IP
 * - proto: Filter by protocol (TCP, UDP, ICMP)
 */
export const GET = withMinimumRole('USER', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const srcFilter = searchParams.get('src');
  const dstFilter = searchParams.get('dst');
  const protoFilter = searchParams.get('proto')?.toUpperCase();

  // Check if flows file exists
  if (!existsSync(FLOWS_FILE)) {
    return NextResponse.json({
      flows: [],
      count: 0,
      configured: false,
      message:
        'NetFlow collector not configured. Install softflowd on your Tailscale nodes to export flows.',
    });
  }

  try {
    // Get file stats
    const stats = statSync(FLOWS_FILE);

    // Read and parse flows
    const lines = readLastLines(FLOWS_FILE, limit * 2); // Read extra in case of parse errors
    let flows = lines.map(parseFlow).filter((f): f is FlowRecord => f !== null);

    // Apply filters
    if (srcFilter) {
      flows = flows.filter((f) => f.SrcAddr.includes(srcFilter));
    }
    if (dstFilter) {
      flows = flows.filter((f) => f.DstAddr.includes(dstFilter));
    }
    if (protoFilter) {
      flows = flows.filter((f) => f.protoName === protoFilter);
    }

    // Limit results
    flows = flows.slice(-limit);

    return NextResponse.json({
      flows,
      count: flows.length,
      configured: true,
      lastModified: stats.mtime.toISOString(),
      fileSize: stats.size,
    });
  } catch (error) {
    console.error('Failed to read flows:', error);
    return NextResponse.json(
      { error: 'Failed to read flow data', flows: [], configured: true },
      { status: 500 }
    );
  }
});
