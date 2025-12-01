import { HeadscaleNode } from './headscale-node';
import { MachineNode } from './machine-node';

export { HeadscaleNode } from './headscale-node';
export type { HeadscaleNodeData } from './headscale-node';
export { MachineNode } from './machine-node';
export type { MachineNodeData } from './machine-node';

/**
 * Node types registry for React Flow
 * Must be defined outside components to prevent recreation
 */
export const nodeTypes = {
  machine: MachineNode,
  headscale: HeadscaleNode,
};
