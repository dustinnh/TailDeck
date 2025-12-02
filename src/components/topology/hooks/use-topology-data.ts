'use client';

import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import { useMemo } from 'react';

import { useNodes } from '@/lib/api/hooks/use-nodes';
import { useRoutes, isExitNodeRoute } from '@/lib/api/hooks/use-routes';
import { useHeadscaleUsers } from '@/lib/api/hooks/use-users';

import type { RouteEdgeData } from '../edges/route-edge';
import type { HeadscaleNodeData } from '../nodes/headscale-node';
import type { MachineNodeData } from '../nodes/machine-node';

// Unique ID for the Headscale server node
const HEADSCALE_NODE_ID = 'headscale-server';

export interface TopologyData {
  flowNodes: FlowNode<MachineNodeData | HeadscaleNodeData>[];
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
  const { data: users, isLoading: usersLoading, error: usersError } = useHeadscaleUsers();

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!nodes || !routes) {
      return { flowNodes: [], flowEdges: [] };
    }

    // Create Headscale server node (always shown, even with no machines)
    const headscaleNode: FlowNode<HeadscaleNodeData> = {
      id: HEADSCALE_NODE_ID,
      type: 'headscale',
      position: { x: 0, y: 0 }, // Will be positioned by layout
      data: {
        id: HEADSCALE_NODE_ID,
        label: 'Headscale',
        online: true, // If we got data, server is online
        nodeCount: nodes.length,
        userCount: users?.length ?? 0,
      },
    };

    // Transform Headscale nodes to React Flow nodes
    const machineNodes: FlowNode<MachineNodeData>[] = nodes.map((node) => {
      const nodeRoutes = routes.filter((r) => r.node.id === node.id);
      const hasExitNode = nodeRoutes.some(isExitNodeRoute);
      const lastSeenDate = new Date(parseInt(node.lastSeen.seconds) * 1000);
      const expiryDate = node.expiry ? new Date(parseInt(node.expiry.seconds) * 1000) : null;
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const isExpiringSoon = expiryDate ? expiryDate < sevenDaysFromNow && expiryDate > now : false;

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

    // Combine Headscale server node with machine nodes
    const flowNodes: FlowNode<MachineNodeData | HeadscaleNodeData>[] = [
      headscaleNode,
      ...machineNodes,
    ];

    // Create edges - connect all machines to the Headscale server
    const flowEdges: FlowEdge<RouteEdgeData>[] = [];

    // Edge from each machine to Headscale server (control plane connection)
    machineNodes.forEach((machineNode) => {
      flowEdges.push({
        id: `hs-${machineNode.id}`,
        source: machineNode.id,
        target: HEADSCALE_NODE_ID,
        type: 'smoothstep',
        animated: (machineNode.data as MachineNodeData).online,
        style: {
          stroke: (machineNode.data as MachineNodeData).online ? '#3b82f6' : '#6b7280',
          strokeWidth: 2,
          opacity: (machineNode.data as MachineNodeData).online ? 0.8 : 0.3,
        },
      });
    });

    // Also add route edges for machines with advertised routes
    routes.forEach((route) => {
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
  }, [nodes, routes, users]);

  return {
    flowNodes,
    flowEdges,
    isLoading: nodesLoading || routesLoading || usersLoading,
    error: nodesError || routesError || usersError || null,
  };
}
