// Which physics concepts a finished run actually used, read from its chain-reaction stages.
// Pure: the caller supplies how to look up the part type behind a stage key, so this works on a
// live Simulation (results card) and in headless tests alike.

import type { ChainEntry } from '../sim/Simulation';
import { PART_CONCEPTS, type ConceptId } from './science';

/** The entity id a chain key refers to: "id", "magnet>target", "dynamite:boom" or "rope:ropeId". */
export const stageSubject = (key: string): { id: string; rope: boolean } => {
  if (key.startsWith('rope:')) return { id: key.slice(5), rope: true };
  const cut = key.search(/[>:]/);
  return { id: cut >= 0 ? key.slice(0, cut) : key, rope: false };
};

/** The one concept a single stage shows off best. */
export const conceptForStage = (c: ChainEntry, typeOf: (id: string) => string | undefined): ConceptId | null => {
  const { id, rope } = stageSubject(c.key);
  if (rope) return 'heat'; // ropes only become stages by burning through
  const label = c.label.toLowerCase();
  // Two loose things knocking together is a collision, whatever they are.
  if (/ hit the /.test(label)) return 'momentum';
  if (label.includes('cactus')) return 'pressure';
  if (label.includes('too hot')) return 'heat';
  if (label.includes('snuffed by the fan')) return 'air';
  if (label === 'kaboom') return 'heat';
  const type = typeOf(id);
  if (!type) return null;
  return PART_CONCEPTS[type]?.[0] ?? null;
};

/**
 * Concepts in order of first appearance. A run with four or more stages also earns the
 * chain-reaction card, since that is exactly what it was.
 */
export const conceptsInRun = (chain: ChainEntry[], typeOf: (id: string) => string | undefined, max = 6): ConceptId[] => {
  const out: ConceptId[] = [];
  const add = (c: ConceptId | null) => c && !out.includes(c) && out.push(c);
  for (const c of chain) add(conceptForStage(c, typeOf));
  if (new Set(chain.map((c) => c.key)).size < 4) return out.slice(0, max);
  const rest = out.filter((c) => c !== 'chain').slice(0, max - 1);
  return [...rest, 'chain'];
};
