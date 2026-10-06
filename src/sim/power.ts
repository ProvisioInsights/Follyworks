// Approachable electricity: SOURCE -> WIRE -> SWITCH -> DEVICE.
// Every port carries a single boolean "energised". Wires copy an output port to input ports.
// Pass-through parts (switches, plates, logic) compute outputs from inputs in `logic`.

import type { Entity } from './Entity';
import type { Simulation } from './Simulation';

export interface Wire {
  id: string;
  from: Entity;
  fromPort: string;
  to: Entity;
  toPort: string;
  /** Energised this tick (for drawing). */
  live: boolean;
}

export const propagatePower = (sim: Simulation) => {
  const wires = sim.wires;
  const ents = sim.list;
  for (let pass = 0; pass < 8; pass++) {
    // Inputs from wires (OR of all incoming wires).
    for (const e of ents) for (const k in e.inputs) e.inputs[k] = false;
    for (const w of wires) {
      const v = w.from.alive && w.to.alive && !!w.from.outputs[w.fromPort];
      w.live = v;
      if (v) w.to.inputs[w.toPort] = true;
    }
    let changed = false;
    for (const e of ents) {
      if (!e.alive || !e.def.logic) continue;
      const before = snapshotOutputs(e);
      e.def.logic(e, sim);
      if (before !== snapshotOutputs(e)) changed = true;
    }
    if (!changed && pass > 0) break;
  }
};

const snapshotOutputs = (e: Entity) => {
  let s = '';
  for (const k in e.outputs) s += e.outputs[k] ? '1' : '0';
  return s;
};
