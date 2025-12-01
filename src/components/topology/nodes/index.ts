import { MachineNode } from './machine-node';

export { MachineNode } from './machine-node';
export type { MachineNodeData } from './machine-node';

/**
 * Node types registry for React Flow
 * Must be defined outside components to prevent recreation
 */
export const nodeTypes = {
  machine: MachineNode,
};
