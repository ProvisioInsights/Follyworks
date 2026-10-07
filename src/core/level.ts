// Level parsing, validation and migration. Every level (campaign, custom, imported, sandbox)
// goes through parseLevel before use, so malformed data never reaches the simulation.

import { getComponent, normalizeProps } from '../components/registry';
import {
  LEVEL_SCHEMA_VERSION,
  type BuildDef,
  type ConnectionDef,
  type GoalDef,
  type GuideStep,
  type GuideTrigger,
  type InventoryItem,
  type LevelDef,
  type ObjectDef,
  type Rect,
  type Props,
  type Selector,
  type Vec,
} from './types';

export class LevelError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);

export const ENVIRONMENT_IDS = ['garage', 'underground', 'greenhouse', 'maintenance', 'basement', 'research', 'backyard', 'playroom'];
const TOOL_TYPES = ['rope', 'belt', 'wire'];

export const parseObject = (raw: unknown, problems: string[]): ObjectDef | null => {
  if (!isObj(raw)) {
    problems.push('object entry is not an object');
    return null;
  }
  const type = str(raw.type, '');
  const def = getComponent(type);
  if (!def) {
    problems.push(`unknown component type "${type}"`);
    return null;
  }
  const id = str(raw.id, '');
  if (!id) {
    problems.push(`${type} without id`);
    return null;
  }
  const o: ObjectDef = {
    id,
    type,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    angle: def.rotatable ? num(raw.angle, 0) : 0,
    props: normalizeProps(def, isObj(raw.props) ? (raw.props as any) : {}),
  };
  if (raw.flip === true && def.flippable) o.flip = true;
  return o;
};

export const parseConnection = (raw: unknown, problems: string[]): ConnectionDef | null => {
  if (!isObj(raw)) return null;
  const kind = raw.kind;
  if (kind !== 'wire' && kind !== 'rope' && kind !== 'belt') {
    problems.push(`bad connection kind ${String(kind)}`);
    return null;
  }
  const ref = (r: unknown) => (isObj(r) && typeof r.obj === 'string' && typeof r.port === 'string' ? { obj: r.obj, port: r.port } : null);
  const from = ref(raw.from);
  const to = ref(raw.to);
  if (!from || !to) {
    problems.push('connection with bad endpoints');
    return null;
  }
  const c: ConnectionDef = { id: str(raw.id, `c${Math.random().toString(36).slice(2, 8)}`), kind, from, to };
  if (Array.isArray(raw.via)) c.via = raw.via.filter((v): v is string => typeof v === 'string');
  if (isObj(raw.props)) {
    c.props = {};
    for (const [k, v] of Object.entries(raw.props)) if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') c.props[k] = v;
  }
  return c;
};

const parseSelector = (raw: unknown): Selector | null => {
  if (!isObj(raw)) return null;
  if (typeof raw.id === 'string') return { id: raw.id };
  if (typeof raw.type === 'string') return { type: raw.type };
  if (typeof raw.tag === 'string') return { tag: raw.tag };
  return null;
};
const parseRect = (raw: unknown): Rect | null =>
  isObj(raw) ? { x: num(raw.x, 0), y: num(raw.y, 0), w: Math.max(4, num(raw.w, 100)), h: Math.max(4, num(raw.h, 100)) } : null;

export const parseGoal = (raw: unknown, problems: string[]): GoalDef | null => {
  if (!isObj(raw)) return null;
  const label = typeof raw.label === 'string' ? raw.label : undefined;
  switch (raw.kind) {
    case 'enterRegion': {
      const target = parseSelector(raw.target);
      const region = parseRect(raw.region);
      if (!target || !region) break;
      return { kind: 'enterRegion', target, region, hold: typeof raw.hold === 'number' ? raw.hold : undefined, label };
    }
    case 'contact': {
      const a = parseSelector(raw.a);
      const b = parseSelector(raw.b);
      if (!a || !b) break;
      return { kind: 'contact', a, b, label };
    }
    case 'activate': {
      const target = parseSelector(raw.target);
      if (!target) break;
      const count = typeof raw.count === 'number' && Number.isFinite(raw.count) ? Math.min(99, Math.max(1, Math.round(raw.count))) : undefined;
      return { kind: 'activate', target, duration: typeof raw.duration === 'number' ? raw.duration : undefined, count: count && count > 1 ? count : undefined, label };
    }
    case 'containerCount': {
      if (typeof raw.container !== 'string') break;
      return {
        kind: 'containerCount',
        container: raw.container,
        count: Math.max(1, Math.round(num(raw.count, 1))),
        filter: parseSelector(raw.filter) ?? undefined,
        label,
      };
    }
    case 'height': {
      const target = parseSelector(raw.target);
      if (!target) break;
      return { kind: 'height', target, maxY: num(raw.maxY, 0), label };
    }
    case 'destroyed': {
      const target = parseSelector(raw.target);
      if (!target) break;
      return { kind: 'destroyed', target, label };
    }
  }
  problems.push(`unrecognised goal ${JSON.stringify(raw).slice(0, 80)}`);
  return null;
};

/** Upgrade older schema versions in place. Version 1 is current. */
export const migrateLevel = (raw: Record<string, unknown>): Record<string, unknown> => {
  const v = num(raw.schemaVersion, 0);
  if (v > LEVEL_SCHEMA_VERSION) throw new LevelError(`Level was made with a newer Follyworks (schema ${v}).`);
  if (v < 1) {
    // Pre-release drafts used a single `objects` array; treat them as starting objects.
    if (Array.isArray(raw.objects) && !Array.isArray(raw.startingObjects)) raw.startingObjects = raw.objects;
    raw.schemaVersion = 1;
  }
  return raw;
};

export interface ParseResult {
  level: LevelDef;
  problems: string[];
}

const vec = (v: unknown): Vec | undefined => (isObj(v) && typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : undefined);
const HUD_TARGETS = ['run', 'rotate', 'flip', 'hint', 'reset', 'connect'];

const parseGuideTrigger = (u: unknown): GuideTrigger | null => {
  if (!isObj(u)) return null;
  switch (u.kind) {
    case 'place': {
      if (typeof u.type !== 'string') return null;
      const t: GuideTrigger = { kind: 'place', type: u.type };
      const at = vec(u.at);
      if (at) t.at = at;
      if (typeof u.radius === 'number') t.radius = Math.max(4, u.radius);
      if (typeof u.angle === 'number') t.angle = u.angle;
      if (typeof u.angleTol === 'number') t.angleTol = Math.max(0.01, u.angleTol);
      return t;
    }
    case 'connect':
      return u.connection === 'wire' || u.connection === 'rope' || u.connection === 'belt' ? { kind: 'connect', connection: u.connection } : null;
    case 'run':
    case 'ack':
      return { kind: u.kind };
    default:
      return null;
  }
};

const parseGuideStep = (g: unknown): GuideStep | null => {
  if (!isObj(g) || typeof g.text !== 'string') return null;
  const until = parseGuideTrigger(g.until);
  if (!until) return null;
  const step: GuideStep = { text: g.text.slice(0, 300), until };
  const p = g.point;
  if (isObj(p)) {
    const w = vec(p.world);
    if (w) step.point = { world: w };
    else if (typeof p.bin === 'string') step.point = { bin: p.bin };
    else if (typeof p.hud === 'string' && HUD_TARGETS.includes(p.hud)) step.point = { hud: p.hud as 'run' };
  }
  const gh = g.ghost;
  if (isObj(gh) && typeof gh.type === 'string' && typeof gh.x === 'number' && typeof gh.y === 'number') {
    step.ghost = { type: gh.type, x: gh.x, y: gh.y };
    if (typeof gh.angle === 'number') step.ghost.angle = gh.angle;
    if (gh.flip === true) step.ghost.flip = true;
    if (isObj(gh.props)) step.ghost.props = { ...(gh.props as Props) };
  }
  return step;
};

/** Parse untrusted JSON into a valid LevelDef. Throws LevelError only when unusable. */
export const parseLevel = (input: unknown): ParseResult => {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new LevelError('That is not valid level data (JSON could not be read).');
    }
  }
  if (!isObj(raw)) throw new LevelError('Level data must be an object.');
  if (isObj(raw.level) && raw.format === 'follyworks-level') raw = raw.level;
  if (!isObj(raw)) throw new LevelError('Level data must be an object.');
  const r = migrateLevel({ ...raw });
  const problems: string[] = [];
  const world = isObj(r.world) ? r.world : {};
  const level: LevelDef = {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: str(r.id, `custom-${Date.now().toString(36)}`),
    name: str(r.name, 'Untitled Contraption').slice(0, 80),
    description: str(r.description, '').slice(0, 400),
    environment: ENVIRONMENT_IDS.includes(str(r.environment, '')) ? (r.environment as string) : 'garage',
    world: {
      width: Math.min(3200, Math.max(800, num(world.width, 1600))),
      height: Math.min(1800, Math.max(500, num(world.height, 900))),
      gravity: Math.min(2, Math.max(0.2, num(world.gravity, 1))),
    },
    fixedObjects: [],
    startingObjects: [],
    connections: [],
    inventory: [],
    goals: [],
  };
  const ids = new Set<string>();
  const take = (list: unknown, into: ObjectDef[]) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const o = parseObject(item, problems);
      if (!o) continue;
      if (ids.has(o.id)) {
        problems.push(`duplicate id ${o.id}`);
        continue;
      }
      ids.add(o.id);
      into.push(o);
    }
  };
  take(r.fixedObjects, level.fixedObjects);
  take(r.startingObjects, level.startingObjects);
  if (Array.isArray(r.connections))
    for (const c of r.connections) {
      const pc = parseConnection(c, problems);
      if (pc && ids.has(pc.from.obj) && ids.has(pc.to.obj)) level.connections.push(pc);
      else if (pc) problems.push(`connection ${pc.id} points at missing objects`);
    }
  if (Array.isArray(r.inventory))
    for (const it of r.inventory) {
      if (!isObj(it) || typeof it.type !== 'string') continue;
      const def = getComponent(it.type);
      if (!TOOL_TYPES.includes(it.type) && (!def || def.internal)) {
        problems.push(`inventory has unknown part ${it.type}`);
        continue;
      }
      const count = Math.round(num(it.count, 1));
      const item: InventoryItem = { type: it.type, count: count < 0 ? -1 : Math.min(99, count) };
      const existing = level.inventory.find((q) => q.type === item.type);
      if (existing) existing.count = existing.count < 0 || item.count < 0 ? -1 : Math.min(99, existing.count + item.count);
      else level.inventory.push(item);
    }
  if (Array.isArray(r.goals))
    for (const g of r.goals) {
      const pg = parseGoal(g, problems);
      if (pg) level.goals.push(pg);
    }
  if (isObj(r.restrictions)) {
    level.restrictions = {};
    if (typeof r.restrictions.maxParts === 'number') level.restrictions.maxParts = Math.max(0, Math.round(r.restrictions.maxParts));
    if (typeof r.restrictions.timeLimit === 'number') level.restrictions.timeLimit = Math.max(1, r.restrictions.timeLimit);
  }
  if (isObj(r.bonus)) {
    level.bonus = {};
    if (typeof r.bonus.elegantParts === 'number') level.bonus.elegantParts = Math.max(0, Math.round(r.bonus.elegantParts));
    if (typeof r.bonus.absurdStages === 'number') level.bonus.absurdStages = Math.max(0, Math.round(r.bonus.absurdStages));
    if (typeof r.bonus.elegantTime === 'number') level.bonus.elegantTime = Math.max(0.5, r.bonus.elegantTime);
  }
  if (Array.isArray(r.hints)) level.hints = r.hints.filter((h): h is string => typeof h === 'string').slice(0, 6);
  if (Array.isArray(r.guide)) {
    const guide = r.guide.map(parseGuideStep).filter((g): g is GuideStep => !!g).slice(0, 20);
    if (guide.length) level.guide = guide;
  }
  if (isObj(r.metadata)) {
    const m = r.metadata;
    level.metadata = {
      author: typeof m.author === 'string' ? m.author.slice(0, 60) : undefined,
      chapter: typeof m.chapter === 'number' ? m.chapter : undefined,
      order: typeof m.order === 'number' ? m.order : undefined,
      created: typeof m.created === 'string' ? m.created : undefined,
      updated: typeof m.updated === 'string' ? m.updated : undefined,
      tutorial: m.tutorial === true ? true : undefined,
      blurb: typeof m.blurb === 'string' ? m.blurb.slice(0, 160) : undefined,
    };
  }
  return { level, problems };
};

/** Parse a player build against a level (drops bad objects and dangling connections). */
export const parseBuild = (raw: unknown, level: LevelDef): BuildDef => {
  const problems: string[] = [];
  const build: BuildDef = { objects: [], connections: [] };
  if (!isObj(raw)) return build;
  const ids = new Set<string>([...level.fixedObjects, ...level.startingObjects].map((o) => o.id));
  if (Array.isArray(raw.objects))
    for (const item of raw.objects) {
      const o = parseObject(item, problems);
      if (o && !ids.has(o.id)) {
        ids.add(o.id);
        build.objects.push(o);
      }
    }
  if (Array.isArray(raw.connections))
    for (const c of raw.connections) {
      const pc = parseConnection(c, problems);
      if (pc && ids.has(pc.from.obj) && ids.has(pc.to.obj)) build.connections.push(pc);
    }
  return build;
};

/** Portable export wrapper. */
export const exportLevel = (level: LevelDef) =>
  JSON.stringify({ format: 'follyworks-level', version: LEVEL_SCHEMA_VERSION, level }, null, 2);

/**
 * The standard workshop size for campaign, sandbox and new custom levels. Parts keep their
 * physical sizes, so a smaller room shows them bigger on screen (the 1600×900 room made a
 * rubber ball about 20 px tall on a laptop).
 */
export const STANDARD_WORLD = { width: 1120, height: 630, gravity: 1 } as const;

export const blankLevel = (id: string, name = 'Untitled Contraption'): LevelDef => ({
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id,
  name,
  description: '',
  environment: 'garage',
  world: { ...STANDARD_WORLD },
  fixedObjects: [],
  startingObjects: [],
  connections: [],
  inventory: [],
  goals: [],
  metadata: { author: 'You', created: new Date().toISOString() },
});
