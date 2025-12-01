'use client';

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import type { Node as FlowNode, Edge as FlowEdge, NodeMouseHandler } from '@xyflow/react';
import { Loader2, LayoutGrid, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { edgeTypes } from './edges';
import type { RouteEdgeData } from './edges/route-edge';
import { useElkLayout, calculateGridLayout } from './hooks/use-elk-layout';
import { useTopologyData } from './hooks/use-topology-data';
import { nodeTypes } from './nodes';
import type { HeadscaleNodeData } from './nodes/headscale-node';
import type { MachineNodeData } from './nodes/machine-node';
import { TopologyDetailsPanel } from './topology-details-panel';
import { TopologyLegend } from './topology-legend';

import '@xyflow/react/dist/style.css';

// Union type for all node data types in the topology
type TopologyNodeData = MachineNodeData | HeadscaleNodeData;

/**
 * Main Network Topology Component
 * Shows an interactive graph visualization of the network
 */
function TopologyContent() {
  const { resolvedTheme } = useTheme();
  const { flowNodes, flowEdges, isLoading, error } = useTopologyData();
  const { isLayouting } = useElkLayout();

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode<TopologyNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge<RouteEdgeData>>([]);
  const [selectedNode, setSelectedNode] = useState<TopologyNodeData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hasInitialLayout, setHasInitialLayout] = useState(false);

  // Apply initial layout when data loads
  useEffect(() => {
    const applyLayout = async () => {
      if (flowNodes.length > 0 && !hasInitialLayout) {
        // Use grid layout for simplicity and reliability
        const layoutedNodes = calculateGridLayout(flowNodes, 4, 80);
        setNodes(layoutedNodes);
        setEdges(flowEdges);
        setHasInitialLayout(true);
      }
    };

    applyLayout();
  }, [flowNodes, flowEdges, hasInitialLayout, setNodes, setEdges]);

  // Update edges when data changes (but preserve node positions)
  useEffect(() => {
    if (hasInitialLayout) {
      setEdges(flowEdges);
    }
  }, [flowEdges, hasInitialLayout, setEdges]);

  // Handle node click to show details panel
  const onNodeClick: NodeMouseHandler<FlowNode<TopologyNodeData>> = useCallback((_event, node) => {
    setSelectedNode(node.data);
    setIsPanelOpen(true);
  }, []);

  // Close details panel
  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // Deselect when clicking on canvas
  const onPaneClick = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // Re-layout nodes
  const onRelayout = useCallback(() => {
    if (nodes.length > 0) {
      const layoutedNodes = calculateGridLayout(nodes, 4, 80);
      setNodes(layoutedNodes);
    }
  }, [nodes, setNodes]);

  // Refresh data and re-layout
  const onRefresh = useCallback(() => {
    setHasInitialLayout(false);
  }, []);

  // Color function for minimap
  const getNodeColor = useCallback((node: FlowNode<TopologyNodeData>) => {
    // Headscale server node always blue
    if (node.type === 'headscale') return '#3b82f6'; // blue
    // Machine nodes
    const machineData = node.data as MachineNodeData;
    if (machineData?.isExitNode) return '#8b5cf6'; // violet
    if (machineData?.online) return '#10b981'; // emerald
    return '#6b7280'; // gray
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading network topology...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="h-full border-destructive">
        <CardContent className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-destructive">Failed to load network topology</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (flowNodes.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">No machines in your network yet</p>
            <p className="text-xs text-muted-foreground">
              Add machines to see them in the topology view
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick as NodeMouseHandler}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
        <Controls position="top-left" showInteractive={false} />
        <MiniMap
          nodeColor={getNodeColor as (node: FlowNode) => string}
          maskColor="hsl(var(--background) / 0.8)"
          className="!rounded-lg !border-border !bg-card"
          position="top-right"
        />
        <TopologyLegend />

        {/* Control buttons */}
        <Panel position="top-center" className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRelayout}
            disabled={isLayouting}
            className="bg-card shadow-sm"
          >
            {isLayouting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LayoutGrid className="mr-2 h-4 w-4" />
            )}
            Auto Layout
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} className="bg-card shadow-sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </Panel>
      </ReactFlow>

      {/* Details Panel */}
      <TopologyDetailsPanel node={selectedNode} onClose={closePanel} isOpen={isPanelOpen} />
    </div>
  );
}

/**
 * Wrapper component with ReactFlowProvider
 */
export function NetworkTopology({ className }: { className?: string }) {
  return (
    <div className={className} style={{ height: '100%', minHeight: '500px' }}>
      <ReactFlowProvider>
        <TopologyContent />
      </ReactFlowProvider>
    </div>
  );
}
