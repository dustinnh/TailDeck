'use client';

import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import { useCallback, useMemo, useState } from 'react';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;

/**
 * ELK layout hook for automatic node positioning
 */
export function useElkLayout() {
  const [isLayouting, setIsLayouting] = useState(false);

  const elk = useMemo(() => new ELK(), []);

  const calculateLayout = useCallback(
    async <NodeData extends Record<string, unknown>, EdgeData extends Record<string, unknown>>(
      nodes: FlowNode<NodeData>[],
      edges: FlowEdge<EdgeData>[]
    ): Promise<FlowNode<NodeData>[]> => {
      if (nodes.length === 0) return nodes;

      setIsLayouting(true);

      try {
        // Filter edges to only include those between existing nodes
        const nodeIds = new Set(nodes.map((n) => n.id));
        const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'force',
            'elk.force.iterations': '300',
            'elk.spacing.nodeNode': '100',
            'elk.force.repulsion': '2.0',
            'elk.padding': '[top=50,left=50,bottom=50,right=50]',
          },
          children: nodes.map((node) => ({
            id: node.id,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          })),
          edges: validEdges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
          })),
        };

        const layoutedGraph = await elk.layout(elkGraph);

        const layoutedNodes = nodes.map((node) => {
          const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
          if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
            return {
              ...node,
              position: { x: elkNode.x, y: elkNode.y },
            };
          }
          return node;
        });

        return layoutedNodes;
      } finally {
        setIsLayouting(false);
      }
    },
    [elk]
  );

  return { calculateLayout, isLayouting };
}

/**
 * Simple grid layout fallback when ELK is not needed
 */
export function calculateGridLayout<NodeData extends Record<string, unknown>>(
  nodes: FlowNode<NodeData>[],
  columns = 4,
  gap = 50
): FlowNode<NodeData>[] {
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % columns) * (NODE_WIDTH + gap),
      y: Math.floor(index / columns) * (NODE_HEIGHT + gap),
    },
  }));
}
