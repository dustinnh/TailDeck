import { RouteEdge } from './route-edge';

export { RouteEdge } from './route-edge';
export type { RouteEdgeData } from './route-edge';

/**
 * Edge types registry for React Flow
 * Must be defined outside components to prevent recreation
 */
export const edgeTypes = {
  route: RouteEdge,
};
