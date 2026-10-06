// Inventory rules: what the player may still place. Pure functions so they are easy to test.

import { getComponent, paletteComponents } from '../components/registry';
import type { BuildDef, LevelDef } from '../core/types';

export const UNLIMITED = -1;

export interface InventoryRow {
  type: string;
  total: number; // -1 unlimited
  used: number;
  remaining: number; // -1 unlimited
}

export const countUsed = (build: BuildDef): Map<string, number> => {
  const m = new Map<string, number>();
  for (const o of build.objects) m.set(o.type, (m.get(o.type) ?? 0) + 1);
  for (const c of build.connections) if (c.kind !== 'wire') m.set(c.kind, (m.get(c.kind) ?? 0) + 1);
  return m;
};

export const partsPlaced = (build: BuildDef) =>
  build.objects.length + build.connections.filter((c) => c.kind !== 'wire').length;

/** Inventory with usage, in the level's listed order. `unlimited` gives every palette part. */
export const inventoryRows = (level: LevelDef, build: BuildDef, unlimited: boolean): InventoryRow[] => {
  const used = countUsed(build);
  if (unlimited) {
    const types = [...paletteComponents().filter((d) => !d.sceneryOnly).map((d) => d.type), 'rope', 'belt', 'wire'];
    return types.map((t) => ({ type: t, total: UNLIMITED, used: used.get(t) ?? 0, remaining: UNLIMITED }));
  }
  const rows: InventoryRow[] = level.inventory.map((it) => {
    const u = used.get(it.type) ?? 0;
    return { type: it.type, total: it.count, used: u, remaining: it.count < 0 ? UNLIMITED : Math.max(0, it.count - u) };
  });
  // Wires are always free whenever the level contains anything with a power port.
  if (!rows.some((r) => r.type === 'wire') && levelUsesPower(level, build)) {
    rows.push({ type: 'wire', total: UNLIMITED, used: used.get('wire') ?? 0, remaining: UNLIMITED });
  }
  return rows;
};

const levelUsesPower = (level: LevelDef, build: BuildDef) => {
  const types = new Set([...level.startingObjects, ...level.fixedObjects, ...build.objects].map((o) => o.type));
  for (const it of level.inventory) types.add(it.type);
  for (const t of types) {
    const d = getComponent(t);
    if (d && d.ports && (typeof d.ports === 'function' || d.ports.length > 0)) return true;
  }
  return false;
};

export const canPlace = (level: LevelDef, build: BuildDef, type: string, unlimited: boolean): { ok: boolean; reason?: string } => {
  if (unlimited) return { ok: true };
  if (type === 'wire') return { ok: true };
  const max = level.restrictions?.maxParts;
  if (max !== undefined && partsPlaced(build) >= max) return { ok: false, reason: `This level allows only ${max} parts.` };
  const row = inventoryRows(level, build, false).find((r) => r.type === type);
  if (!row) return { ok: false, reason: 'Not in this level’s parts bin.' };
  if (row.remaining === 0) return { ok: false, reason: 'None left in the bin.' };
  return { ok: true };
};
