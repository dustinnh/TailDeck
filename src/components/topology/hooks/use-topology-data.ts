'use client';

import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import { useMemo } from 'react';

import { useNodes } from '@/lib/api/hooks/use-nodes';
import { useRoutes, isExitNodeRoute } from '@/lib/api/hooks/use-routes';

import type { RouteEdgeData } from '../edges/route-edge';
import type { MachineNodeData } from '../nodes/machine-node';

export interface TopologyData {
  flowNodes: FlowNode<MachineNodeData>[];
  flowEdges: FlowEdge<RouteEdgeData>[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Transform Headscale data to React Flow format
 */
export function useTopologyData(): TopologyData {
  const { data: nodes, isLoading: nodesLoading, error: nodesError } = useNodes();
  const { data: routes, isLoading: routesLoading, error: routesError } = useRoutes();

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!nodes || !routes) {
      return { flowNodes: [], flowEdges: [] };
    }

    // Transform Headscale nodes to React Flow nodes
    const flowNodes: FlowNode<MachineNodeData>[] = nodes.map((node) => {
      const nodeRoutes = routes.filter((r) => r.node.id === node.id);
      const hasExitNode = nodeRoutes.some(isExitNodeRoute);
      const lastSeenDate = new Date(parseInt(node.lastSeen.seconds) * 1000);
      const expiryDate = new Date(parseInt(node.expiry.seconds) * 1000);
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const isExpiringSoon = expiryDate < sevenDaysFromNow && expiryDate > now;

      return {
        id: node.id,
        type: 'machine',
        position: { x: 0, y: 0 }, // Will be set by ELK layout
        data: {
          id: node.id,
          label: node.givenName || node.name,
          name: node.name,
          givenName: node.givenName,
          ipAddresses: node.ipAddresses,
          online: node.online,
          user: node.user.name,
          userId: node.user.id,
          isExitNode: hasExitNode,
          isExpiringSoon,
          routes: nodeRoutes.map((r) => ({
            id: r.id,
            prefix: r.prefix,
            enabled: r.enabled,
            isPrimary: r.isPrimary,
            isExitRoute: isExitNodeRoute(r),
          })),
          lastSeen: lastSeenDate,
          expiry: expiryDate,
          tags: [...node.forcedTags, ...node.validTags],
          machineKey: node.machineKey,
          registerMethod: node.registerMethod,
        },
      };
    });

    // Create edges between nodes that share routes
    // For now, create edges from nodes with enabled routes to show connectivity
    const flowEdges: FlowEdge<RouteEdgeData>[] = [];

    // Group nodes by user for visual clustering later
    // For edges, we'll connect nodes that have routes
    routes.forEach((route) => {
      // Create a virtual edge showing routes being advertised
      // This visualizes which nodes are advertising routes
      if (route.advertised) {
        flowEdges.push({
          id: `route-${route.id}`,
          source: route.node.id,
          target: `network-${route.node.id}`, // Self-reference to show route advertisement
          type: 'route',
          animated: route.enabled,
          data: {
            prefix: route.prefix,
            enabled: route.enabled,
            isPrimary: route.isPrimary,
            isExitRoute: isExitNodeRoute(route),
          },
        });
      }
    });

    return { flowNodes, flowEdges };
  }, [nodes, routes]);

  return {
    flowNodes,
    flowEdges,
    isLoading: nodesLoading || routesLoading,
    error: nodesError || routesError || null,
  };
}
