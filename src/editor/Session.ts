// An editing session over one authored document: a level plus the player's build on top.
// All mutations go through `commit`, which snapshots the document for undo/redo. RUN never
// touches the session; it builds a separate Simulation from a copy.

import { getComponent, normalizeProps, resolvePorts } from '../components/registry';
import type { BuildDef, ConnectionDef, LevelDef, ObjectDef, Props } from '../core/types';
import { deepClone, newId } from '../core/util';
import { canPlace, inventoryRows, type InventoryRow } from './inventory';

export type SessionKind = 'campaign' | 'custom' | 'sandbox' | 'editor' | 'test';

interface DocState {
  level: LevelDef;
  build: BuildDef;
}

export interface ClipboardItem {
  objects: ObjectDef[];
  connections: ConnectionDef[];
}

export class Session {
  readonly kind: SessionKind;
  level: LevelDef;
  build: BuildDef;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private listeners = new Set<(reason: string) => void>();
  /** Increments on every change; views use it to know when to rebuild. */
  version = 0;

  constructor(kind: SessionKind, level: LevelDef, build: BuildDef) {
    this.kind = kind;
    this.level = deepClone(level);
    this.build = deepClone(build);
  }

  /** In the level editor the author edits the level itself; everyone else edits their build. */
  get editsLevel() {
    return this.kind === 'editor';
  }
  get unlimited() {
    return this.kind === 'sandbox' || this.kind === 'editor';
  }

  onChange(fn: (reason: string) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(reason: string) {
    this.version++;
    for (const fn of this.listeners) fn(reason);
  }

  private state(): string {
    return JSON.stringify({ level: this.level, build: this.build } satisfies DocState);
  }
  private load(s: string) {
    const d = JSON.parse(s) as DocState;
    this.level = d.level;
    this.build = d.build;
  }

  /** Apply a mutation with undo support. Return false from fn to cancel. */
  commit(reason: string, fn: () => boolean | void): boolean {
    const before = this.state();
    const res = fn();
    if (res === false) {
      this.load(before);
      return false;
    }
    if (this.state() === before) return false;
    this.undoStack.push(before);
    if (this.undoStack.length > 150) this.undoStack.shift();
    this.redoStack = [];
    this.emit(reason);
    return true;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  undo() {
    const s = this.undoStack.pop();
    if (!s) return false;
    this.redoStack.push(this.state());
    this.load(s);
    this.emit('undo');
    return true;
  }
  redo() {
    const s = this.redoStack.pop();
    if (!s) return false;
    this.undoStack.push(this.state());
    this.load(s);
    this.emit('redo');
    return true;
  }

  /** Replace the whole document (e.g. loading), clearing history. */
  replace(level: LevelDef, build: BuildDef) {
    this.level = deepClone(level);
    this.build = deepClone(build);
    this.undoStack = [];
    this.redoStack = [];
    this.emit('replace');
  }

  // ------------------------------------------------------------- object access

  /** Objects the user may edit in this session. */
  editableObjects(): ObjectDef[] {
    return this.editsLevel ? [...this.level.fixedObjects, ...this.level.startingObjects] : this.build.objects;
  }
  editableConnections(): ConnectionDef[] {
    return this.editsLevel ? this.level.connections : this.build.connections;
  }
  allObjects(): ObjectDef[] {
    return [...this.level.fixedObjects, ...this.level.startingObjects, ...this.build.objects];
  }
  allConnections(): ConnectionDef[] {
    return [...this.level.connections, ...this.build.connections];
  }
  isEditable(id: string) {
    return this.editableObjects().some((o) => o.id === id);
  }
  find(id: string): ObjectDef | undefined {
    return this.allObjects().find((o) => o.id === id);
  }
  isFixed(id: string) {
    return this.level.fixedObjects.some((o) => o.id === id);
  }

  inventory(): InventoryRow[] {
    return inventoryRows(this.level, this.build, this.unlimited);
  }
  canPlace(type: string) {
    return canPlace(this.level, this.build, type, this.unlimited);
  }

  private uniqueId(prefix: string) {
    const used = new Set(this.allObjects().map((o) => o.id));
    for (const c of this.allConnections()) used.add(c.id);
    let id = newId(prefix);
    while (used.has(id)) id = newId(prefix);
    return id;
  }

  // ------------------------------------------------------------- mutations (call inside commit or use the wrappers)

  makeObject(type: string, x: number, y: number, props?: Props): ObjectDef {
    const def = getComponent(type)!;
    return { id: this.uniqueId(type.slice(0, 3)), type, x, y, angle: 0, props: normalizeProps(def, props) };
  }

  addObject(o: ObjectDef, asScenery?: boolean) {
    return this.commit('add', () => {
      if (this.editsLevel) {
        const scenery = asScenery ?? getComponent(o.type)?.sceneryOnly ?? false;
        (scenery ? this.level.fixedObjects : this.level.startingObjects).push(o);
      } else {
        if (!this.canPlace(o.type).ok) return false;
        this.build.objects.push(o);
      }
    });
  }

  moveObjects(ids: string[], dx: number, dy: number) {
    return this.commit('move', () => {
      for (const o of this.editableObjects()) if (ids.includes(o.id)) {
        o.x = Math.round((o.x + dx) * 10) / 10;
        o.y = Math.round((o.y + dy) * 10) / 10;
      }
    });
  }

  setTransform(id: string, t: { x?: number; y?: number; angle?: number; flip?: boolean }) {
    return this.commit('transform', () => {
      const o = this.editableObjects().find((q) => q.id === id);
      if (!o) return false;
      if (t.x !== undefined) o.x = Math.round(t.x * 10) / 10;
      if (t.y !== undefined) o.y = Math.round(t.y * 10) / 10;
      if (t.angle !== undefined) o.angle = normalizeAngle(t.angle);
      if (t.flip !== undefined) o.flip = t.flip || undefined;
    });
  }

  /** Position, angle and props in one undo step (used by the on-canvas rotate and resize handles). */
  reshapeObject(id: string, t: { x: number; y: number; angle: number; props?: Props }) {
    return this.commit('reshape', () => {
      const o = this.editableObjects().find((q) => q.id === id);
      const def = o && getComponent(o.type);
      if (!o || !def) return false;
      o.x = Math.round(t.x * 10) / 10;
      o.y = Math.round(t.y * 10) / 10;
      if (def.rotatable) o.angle = normalizeAngle(t.angle);
      if (t.props) o.props = normalizeProps(def, { ...(o.props ?? {}), ...t.props });
    });
  }

  rotateObjects(ids: string[], delta: number) {
    return this.commit('rotate', () => {
      let any = false;
      for (const o of this.editableObjects()) {
        if (!ids.includes(o.id) || !getComponent(o.type)?.rotatable) continue;
        o.angle = normalizeAngle((o.angle || 0) + delta);
        any = true;
      }
      return any;
    });
  }

  /** Set the angle of the given rotatable parts back to 0, as one undo step. */
  resetAngles(ids: string[]) {
    return this.commit('rotate', () => {
      let any = false;
      for (const o of this.editableObjects()) {
        if (!ids.includes(o.id) || !getComponent(o.type)?.rotatable || !o.angle) continue;
        o.angle = 0;
        any = true;
      }
      return any;
    });
  }

  flipObjects(ids: string[]) {
    return this.commit('flip', () => {
      let any = false;
      for (const o of this.editableObjects()) {
        if (!ids.includes(o.id) || !getComponent(o.type)?.flippable) continue;
        o.flip = o.flip ? undefined : true;
        any = true;
      }
      return any;
    });
  }

  setProp(id: string, key: string, value: number | boolean | string) {
    return this.commit('prop', () => {
      const o = this.editableObjects().find((q) => q.id === id);
      const def = o && getComponent(o.type);
      if (!o || !def) return false;
      o.props = normalizeProps(def, { ...(o.props ?? {}), [key]: value });
    });
  }

  deleteObjects(ids: string[]) {
    return this.commit('delete', () => {
      const kill = new Set(ids.filter((id) => this.isEditable(id)));
      if (!kill.size) return false;
      const keep = (o: ObjectDef) => !kill.has(o.id);
      if (this.editsLevel) {
        this.level.fixedObjects = this.level.fixedObjects.filter(keep);
        this.level.startingObjects = this.level.startingObjects.filter(keep);
        this.level.goals = this.level.goals.filter((g) => !goalRefs(g).some((r) => kill.has(r)));
      } else this.build.objects = this.build.objects.filter(keep);
      this.pruneConnections();
    });
  }

  /** Remove connections whose endpoints no longer exist. */
  private pruneConnections() {
    const ids = new Set(this.allObjects().map((o) => o.id));
    const ok = (c: ConnectionDef) => ids.has(c.from.obj) && ids.has(c.to.obj);
    this.level.connections = this.level.connections.filter(ok);
    this.build.connections = this.build.connections.filter(ok);
    for (const c of [...this.level.connections, ...this.build.connections]) if (c.via) c.via = c.via.filter((v) => ids.has(v));
  }

  /** Why a connection may not be made, or null if it may. */
  connectionBlockReason(c: Pick<ConnectionDef, 'kind' | 'from' | 'to'>): string | null {
    if (this.editsLevel) return null;
    if (c.kind === 'wire') {
      // Wires are free, so an input socket the level already feeds stays as the level made it;
      // otherwise the battery could be run straight to a device and skip the level's switch.
      const mine = new Set(this.build.objects.map((o) => o.id));
      const isInput = (end: { obj: string; port?: string }) => {
        const o = this.allObjects().find((q) => q.id === end.obj);
        const def = o && getComponent(o.type);
        return !!def && resolvePorts(def, normalizeProps(def, o!.props)).some((p) => p.id === end.port && p.dir === 'in');
      };
      for (const end of [c.from, c.to]) {
        if (mine.has(end.obj) || !isInput(end)) continue;
        // level wires may have been drawn either way round, so check both of their ends
        const taken = this.level.connections.some(
          (w) => w.kind === 'wire' && [w.from, w.to].some((x) => x.obj === end.obj && x.port === end.port),
        );
        if (taken) return 'That socket is already wired by the level.';
      }
      return null;
    }
    const can = this.canPlace(c.kind);
    return can.ok ? null : (can.reason ?? 'None left in the parts bin.');
  }

  addConnection(c: Omit<ConnectionDef, 'id'>) {
    return this.commit('connect', () => {
      if (this.connectionBlockReason(c)) return false;
      const conn: ConnectionDef = { ...c, id: this.uniqueId(c.kind[0]) } as ConnectionDef;
      this.editableConnections().push(conn);
    });
  }

  removeConnection(id: string) {
    return this.commit('disconnect', () => {
      const list = this.editableConnections();
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) return false;
      list.splice(i, 1);
    });
  }

  setConnectionProp(id: string, key: string, value: number) {
    return this.commit('connprop', () => {
      const c = this.editableConnections().find((q) => q.id === id);
      if (!c) return false;
      c.props = { ...(c.props ?? {}), [key]: value };
    });
  }

  copy(ids: string[]): ClipboardItem | null {
    const objs = this.editableObjects().filter((o) => ids.includes(o.id));
    if (!objs.length) return null;
    const set = new Set(objs.map((o) => o.id));
    const conns = this.editableConnections().filter((c) => set.has(c.from.obj) && set.has(c.to.obj) && (c.via ?? []).every((v) => set.has(v)));
    return deepClone({ objects: objs, connections: conns });
  }

  /** Paste a clipboard offset by (dx, dy). Returns the new ids, or null if inventory refused. */
  paste(clip: ClipboardItem, dx: number, dy: number): string[] | null {
    const map = new Map<string, string>();
    const newIds: string[] = [];
    const ok = this.commit('paste', () => {
      for (const o of clip.objects) {
        if (!this.editsLevel && !this.canPlace(o.type).ok) return false;
        const n = deepClone(o);
        n.id = this.uniqueId(o.type.slice(0, 3));
        n.x += dx;
        n.y += dy;
        map.set(o.id, n.id);
        newIds.push(n.id);
        if (this.editsLevel) {
          const scenery = getComponent(n.type)?.sceneryOnly ?? false;
          (scenery ? this.level.fixedObjects : this.level.startingObjects).push(n);
        } else this.build.objects.push(n);
      }
      for (const c of clip.connections) {
        if (!this.editsLevel && c.kind !== 'wire' && !this.canPlace(c.kind).ok) continue;
        const n = deepClone(c);
        n.id = this.uniqueId(c.kind[0]);
        n.from = { ...n.from, obj: map.get(c.from.obj) ?? c.from.obj };
        n.to = { ...n.to, obj: map.get(c.to.obj) ?? c.to.obj };
        if (n.via) n.via = n.via.map((v) => map.get(v) ?? v);
        this.editableConnections().push(n);
      }
    });
    return ok ? newIds : null;
  }

  /** Level-editor only: toggle an object between fixed scenery and starting part. */
  setScenery(id: string, scenery: boolean) {
    if (!this.editsLevel) return false;
    return this.commit('layer', () => {
      const from = scenery ? this.level.startingObjects : this.level.fixedObjects;
      const to = scenery ? this.level.fixedObjects : this.level.startingObjects;
      const i = from.findIndex((o) => o.id === id);
      if (i < 0) return false;
      to.push(from.splice(i, 1)[0]);
    });
  }

  /** Level-editor only: change level metadata/goals/inventory through a mutator. */
  editLevel(reason: string, fn: (l: LevelDef) => void) {
    return this.commit(reason, () => {
      fn(this.level);
    });
  }

  clearBuild() {
    return this.commit('clear', () => {
      if (this.editsLevel) {
        this.level.fixedObjects = [];
        this.level.startingObjects = [];
        this.level.connections = [];
      } else {
        this.build.objects = [];
        this.build.connections = [];
      }
    });
  }
}

export const normalizeAngle = (a: number) => {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return Math.round(r * 1e4) / 1e4;
};

const goalRefs = (g: LevelDef['goals'][number]): string[] => {
  const ids: string[] = [];
  const sel = (s: any) => s && typeof s.id === 'string' && ids.push(s.id);
  if ('target' in g) sel(g.target);
  if (g.kind === 'contact') {
    sel(g.a);
    sel(g.b);
  }
  if (g.kind === 'containerCount') ids.push(g.container);
  return ids;
};
