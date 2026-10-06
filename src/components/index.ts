// Importing this module registers every component type exactly once.
import './defs/basic';
import './defs/mechanical';
import './defs/force';
import './defs/chaos';
import './defs/control';
import './defs/creature';
import './defs/optics';

export * from './registry';

/** Connection tools that live in the parts bin alongside components. */
export const CONNECTION_TOOLS = {
  rope: {
    type: 'rope',
    name: 'Rope',
    description: 'Tie two hooks together. Click pulleys on the way to route it. Only pulls, never pushes.',
    art: 'tool_rope',
  },
  belt: {
    type: 'belt',
    name: 'Drive Belt',
    description: 'Links two wheels (motors, gears, pulleys, conveyor drives). Both turn the same way.',
    art: 'tool_belt',
  },
  wire: {
    type: 'wire',
    name: 'Wire',
    description: 'Connects a power OUT socket (orange) to a power IN socket (cyan). Always free.',
    art: 'tool_wire',
  },
} as const;

export type ToolType = keyof typeof CONNECTION_TOOLS;
export const isToolType = (t: string): t is ToolType => t in CONNECTION_TOOLS;
