// Build-mode interaction: selecting, dragging, placing from the parts bin, rotating, flipping,
// deleting, copy/paste, connection tools (rope / belt / wire), box select and, in the level
// editor, moving and resizing goal zones. All document changes go through the Session.

import { getComponent } from '../components/registry';
import type { ObjectDef, PortRef, Props, Vec } from '../core/types';
import type { ClipboardItem, Session } from '../editor/Session';
import type { Entity } from '../sim/Entity';
import { M, type MBody } from '../sim/matter';
import { Simulation } from '../sim/Simulation';
import type { PendingConnection, ToolKind } from '../render/Overlays';
import type { WorkshopScene } from '../render/WorkshopScene';
import { invalidPlacements, withExtras } from './placement';

export interface EditorFeedback {
  sfx(name: string, opts?: { vol?: number; pitch?: number }): void;
  toast(msg: string, kind?: 'info' | 'warn'): void;
}

const GRID = 10;
const ROT_STEP = Math.PI / 12;
/** Screen-pixel gap between a part's top edge and its rotate handle. */
const ROT_HANDLE_GAP = 30;

/** On-canvas transform handles for the single selected part, in world coordinates. */
export interface TransformHandles {
  center: Vec;
  /** Where the rotate knob sits, and the point on the part its stem starts from. */
  rotate: { pos: Vec; base: Vec } | null;
  resize: { pos: Vec; axis: 'w' | 'h'; sign: 1 | -1 }[];
  /** Local axes of the part (unit vectors along its width and height). */
  u: Vec;
  v: Vec;
}

type Shape = { x: number; y: number; angle: number; props: Props };

type Drag =
  | { kind: 'move'; ids: string[]; start: Vec; moved: boolean; offset: Vec; valid: boolean; lastCheck: number }
  | { kind: 'place'; obj: ObjectDef; sticky: boolean; offset: Vec; valid: boolean; lastCheck: number; overCanvas: boolean }
  | { kind: 'box'; start: Vec; now: Vec; additive: boolean }
  | { kind: 'pan'; last: Vec }
  | { kind: 'region'; goal: number; mode: 'move' | 'resize'; start: Vec; orig: { x: number; y: number; w: number; h: number } }
  | {
      kind: 'reshape';
      id: string;
      mode: 'rotate' | { axis: 'w' | 'h'; sign: 1 | -1 };
      orig: Shape;
      grab: number;
      valid: boolean;
      changed: boolean;
      lastCheck: number;
    };

export class EditorController {
  readonly session: Session;
  private scene: WorkshopScene;
  private canvas: HTMLCanvasElement;
  private fb: EditorFeedback;
  buildSim!: Simulation;
  selected = new Set<string>();
  selectedConn: string | null = null;
  hover: string | null = null;
  hoverConn: string | null = null;
  tool: ToolKind | null = null;
  pending: (PendingConnection & { from?: PortRef; via: string[] }) | null = null;
  toolHover: Vec | null = null;
  selectedGoal: number | null = null;
  drag: Drag | null = null;
  invalid = new Set<string>();
  snap = true;
  private clipboard: ClipboardItem | null = null;
  private listeners = new Set<() => void>();
  private detach: (() => void)[] = [];
  private lastPointer: Vec = { x: 0, y: 0 };
  enabled = true;
  /** Marquee element for box select. */
  private marquee: HTMLDivElement;

  constructor(scene: WorkshopScene, canvas: HTMLCanvasElement, session: Session, fb: EditorFeedback) {
    this.scene = scene;
    this.canvas = canvas;
    this.session = session;
    this.fb = fb;
    this.marquee = document.createElement('div');
    this.marquee.className = 'marquee';
    this.marquee.style.display = 'none';
    document.body.appendChild(this.marquee);
    this.rebuild();
    this.detach.push(session.onChange(() => this.rebuild()));
    const on = <K extends keyof WindowEventMap>(t: EventTarget, ev: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(ev, fn as EventListener, opts);
      this.detach.push(() => t.removeEventListener(ev, fn as EventListener, opts));
    };
    on(canvas, 'pointerdown', (e) => this.onDown(e));
    on(window, 'pointermove', (e) => this.onMove(e));
    on(window, 'pointerup', (e) => this.onUp(e));
    on(canvas, 'wheel', (e) => this.onWheel(e), { passive: false });
    on(canvas, 'contextmenu', (e) => e.preventDefault());
  }

  destroy() {
    for (const d of this.detach) d();
    this.marquee.remove();
    this.listeners.clear();
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private changed() {
    for (const fn of this.listeners) fn();
  }

  // ------------------------------------------------------------------ build sim

  private sceneryOf = (o: ObjectDef) => !!getComponent(o.type)?.sceneryOnly || !!(o as any).__scenery;

  rebuild(extras: ObjectDef[] = []) {
    const { level, build } = withExtras(this.session.level, this.session.build, extras, this.session.editsLevel, this.sceneryOf);
    this.buildSim = new Simulation(level, build);
    this.buildSim.capturePrev();
    // prune stale selection
    for (const id of [...this.selected]) if (!this.buildSim.entities.has(id)) this.selected.delete(id);
    if (this.selectedConn && !this.connExists(this.selectedConn)) this.selectedConn = null;
    if (this.selectedGoal !== null && this.selectedGoal >= this.session.level.goals.length) this.selectedGoal = null;
    this.scene.setEnvironment(this.session.level.environment, this.session.level.world.width, this.session.level.world.height);
    this.scene.setSim(this.buildSim);
    this.changed();
  }

  private connExists(id: string) {
    return this.session.allConnections().some((c) => c.id === id);
  }

  // ------------------------------------------------------------------ helpers

  private world(e: { clientX: number; clientY: number }): Vec {
    const r = this.canvas.getBoundingClientRect();
    return this.scene.screenToWorld(e.clientX - r.left, e.clientY - r.top);
  }
  private overCanvas(e: { clientX: number; clientY: number; target: EventTarget | null }) {
    return e.target === this.canvas;
  }
  private pickRadius(base: number) {
    return Math.max(base, (base * 1.2) / Math.max(0.3, this.scene.zoom));
  }
  private snapV(v: number) {
    return this.snap ? Math.round(v / GRID) * GRID : Math.round(v);
  }

  editable(id: string) {
    return this.session.isEditable(id);
  }

  /** Entity under a world point; prefers editable parts, then the smallest. */
  pick(p: Vec): Entity | null {
    const bodies = M.Composite.allBodies(this.buildSim.world) as MBody[];
    const hits: { e: Entity; area: number }[] = [];
    for (const b of bodies) {
      const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
      for (const part of parts) {
        if (!M.Bounds.contains(part.bounds, p)) continue;
        if (!M.Vertices.contains(part.vertices, p)) continue;
        const e = this.buildSim.ownerOf(b);
        if (e) hits.push({ e, area: (b.bounds.max.x - b.bounds.min.x) * (b.bounds.max.y - b.bounds.min.y) });
        break;
      }
    }
    // generous fallback: small parts are hard to hit
    if (!hits.length) {
      let best: Entity | null = null;
      let bd = this.pickRadius(10);
      for (const e of this.buildSim.list) {
        if (!e.body) continue;
        const d = Math.hypot(e.body.position.x - p.x, e.body.position.y - p.y) - 12;
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      return best;
    }
    hits.sort((a, b) => Number(this.editable(b.e.id)) - Number(this.editable(a.e.id)) || a.area - b.area);
    return hits[0].e;
  }

  pickConnection(p: Vec): string | null {
    let best: string | null = null;
    let bd = this.pickRadius(8);
    for (const id of [...this.buildSim.ropes.map((r) => r.id), ...this.buildSim.wires.map((w) => w.id), ...this.buildSim.belts.map((b) => b.id)]) {
      const d = this.scene.overlays.connectionDistance(this.buildSim, id, p);
      if (d < bd) {
        bd = d;
        best = id;
      }
    }
    return best;
  }

  connectionEditable(id: string) {
    return this.session.editableConnections().some((c) => c.id === id);
  }

  // ------------------------------------------------------------------ pointer

  private onDown(ev: PointerEvent) {
    if (!this.enabled) return;
    this.canvas.focus?.();
    const p = this.world(ev);
    this.lastPointer = p;
    if (ev.button === 1 || ev.button === 2) {
      if (ev.button === 2 && (this.tool || this.drag?.kind === 'place')) {
        this.cancel();
        return;
      }
      this.drag = { kind: 'pan', last: { x: ev.clientX, y: ev.clientY } };
      return;
    }
    if (this.drag?.kind === 'place') {
      // sticky placement: click to drop
      this.finishPlace(this.drag);
      return;
    }
    if (this.tool) {
      this.toolClick(p);
      return;
    }
    // rotate / resize handles of the selected part
    const hd = this.handleAt(p);
    if (hd) {
      const o = this.session.find(hd.id)!;
      const orig: Shape = { x: o.x, y: o.y, angle: o.angle || 0, props: { ...(o.props ?? {}) } };
      const grab = hd.mode === 'rotate' ? Math.atan2(p.y - o.y, p.x - o.x) - orig.angle : 0;
      this.drag = { kind: 'reshape', id: hd.id, mode: hd.mode, orig, grab, valid: true, changed: false, lastCheck: 0 };
      this.fb.sfx('pickup', { vol: 0.5 });
      this.changed();
      return;
    }
    // level editor: goal zone handles
    if (this.session.editsLevel) {
      const g = this.regionAt(p);
      if (g) {
        this.selectedGoal = g.goal;
        const r = (this.session.level.goals[g.goal] as any).region;
        this.drag = { kind: 'region', goal: g.goal, mode: g.mode, start: p, orig: { ...r } };
        this.changed();
        return;
      }
    }
    const e = this.pick(p);
    if (e) {
      const multi = ev.shiftKey || ev.ctrlKey || ev.metaKey;
      if (multi) {
        if (this.selected.has(e.id)) this.selected.delete(e.id);
        else this.selected.add(e.id);
      } else if (!this.selected.has(e.id)) {
        this.selected = new Set([e.id]);
      }
      this.selectedConn = null;
      const ids = [...this.selected].filter((id) => this.editable(id));
      if (ids.length && this.selected.has(e.id) && this.editable(e.id)) {
        this.drag = { kind: 'move', ids, start: p, moved: false, offset: { x: 0, y: 0 }, valid: true, lastCheck: 0 };
      } else if (!this.editable(e.id)) {
        this.fb.sfx('uiHover');
      }
      this.changed();
      return;
    }
    const conn = this.pickConnection(p);
    if (conn) {
      this.selected.clear();
      this.selectedConn = conn;
      this.fb.sfx('click');
      this.changed();
      return;
    }
    // empty space: box select
    if (!(ev.shiftKey || ev.ctrlKey)) {
      this.selected.clear();
      this.selectedConn = null;
    }
    this.drag = { kind: 'box', start: p, now: p, additive: ev.shiftKey || ev.ctrlKey };
    this.changed();
  }

  private onMove(ev: PointerEvent) {
    if (!this.enabled) return;
    const p = this.world(ev);
    this.lastPointer = p;
    const d = this.drag;
    if (!d) {
      if (ev.target === this.canvas) this.updateHover(p);
      return;
    }
    switch (d.kind) {
      case 'pan':
        this.scene.panBy(ev.clientX - d.last.x, ev.clientY - d.last.y);
        d.last = { x: ev.clientX, y: ev.clientY };
        break;
      case 'move': {
        let dx = p.x - d.start.x;
        let dy = p.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * this.scene.zoom < 4) return;
        if (!d.moved) this.fb.sfx('pickup', { vol: 0.6 });
        d.moved = true;
        const snapped = this.snapMove(d.ids, dx, dy, ev.altKey);
        dx = snapped.x;
        dy = snapped.y;
        d.offset = { x: dx, y: dy };
        for (const id of d.ids) {
          const v = this.scene.view(id);
          if (v) v.dragOffset = { x: dx, y: dy };
        }
        this.throttledCheck(d);
        break;
      }
      case 'place': {
        d.overCanvas = this.overCanvas(ev);
        const v = this.scene.view(d.obj.id);
        const tx = this.snapping(ev) ? this.snapV(p.x) : p.x;
        const ty = this.snapping(ev) ? this.snapV(p.y) : p.y;
        const s = this.gearSnap(d.obj, tx, ty) ?? { x: tx, y: ty };
        d.offset = { x: s.x - d.obj.x, y: s.y - d.obj.y };
        if (v) {
          v.dragOffset = d.offset;
          v.root.setAlpha(d.overCanvas ? 1 : 0);
        }
        this.throttledCheck(d);
        break;
      }
      case 'box':
        d.now = p;
        this.showMarquee(d);
        break;
      case 'reshape':
        this.reshapeTo(d, p, ev.altKey);
        break;
      case 'region': {
        const goal = this.session.level.goals[d.goal] as any;
        const dx = this.snapV(p.x - d.start.x);
        const dy = this.snapV(p.y - d.start.y);
        if (d.mode === 'move') goal.region = { ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy };
        else goal.region = { ...d.orig, w: Math.max(20, d.orig.w + dx), h: Math.max(20, d.orig.h + dy) };
        break;
      }
    }
    this.changed();
  }

  private onUp(ev: PointerEvent) {
    if (!this.enabled) return;
    const d = this.drag;
    if (!d) return;
    switch (d.kind) {
      case 'pan':
        this.drag = null;
        break;
      case 'move': {
        this.drag = null;
        for (const id of d.ids) {
          const v = this.scene.view(id);
          if (v) v.dragOffset = { x: 0, y: 0 };
        }
        if (d.moved) {
          this.check(d);
          if (!d.valid) {
            this.fb.sfx('error');
            this.fb.toast('That spot is taken — parts can’t overlap.', 'warn');
            this.invalid.clear();
          } else {
            this.session.moveObjects(d.ids, d.offset.x, d.offset.y);
            this.fb.sfx('place');
          }
        }
        this.invalid.clear();
        break;
      }
      case 'place':
        // A drag from the bin that ends on the canvas places; a click in the bin becomes sticky
        // (the part follows the cursor until the next click on the canvas).
        if (!d.sticky) {
          if (ev.target === this.canvas) this.finishPlace(d);
          else d.sticky = true;
        }
        break;
      case 'box': {
        this.drag = null;
        this.marquee.style.display = 'none';
        const x0 = Math.min(d.start.x, d.now.x);
        const x1 = Math.max(d.start.x, d.now.x);
        const y0 = Math.min(d.start.y, d.now.y);
        const y1 = Math.max(d.start.y, d.now.y);
        if (x1 - x0 > 4 || y1 - y0 > 4) {
          for (const e of this.buildSim.list) {
            if (!this.editable(e.id) || !e.body) continue;
            const q = e.body.position;
            if (q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) this.selected.add(e.id);
          }
        }
        break;
      }
      case 'reshape': {
        this.drag = null;
        const o = this.session.find(d.id);
        if (!o) break;
        const final: Shape = { x: o.x, y: o.y, angle: o.angle || 0, props: { ...(o.props ?? {}) } };
        // put the live preview back so the commit records a proper undo step
        this.applyShape(o, d.orig);
        if (!d.changed) {
          this.rebuild();
          break;
        }
        this.checkReshape(d, final);
        this.scene.view(d.id)?.setGhost(false, true);
        this.invalid.clear();
        if (!d.valid) {
          this.rebuild();
          this.fb.sfx('error');
          this.fb.toast(d.mode === 'rotate' ? 'No room to rotate there.' : 'No room to make it that size.', 'warn');
        } else {
          this.session.reshapeObject(d.id, final);
          this.fb.sfx(d.mode === 'rotate' ? 'rotate' : 'place');
        }
        break;
      }
      case 'region': {
        this.drag = null;
        const goal = this.session.level.goals[d.goal] as any;
        const final = { ...goal.region };
        goal.region = d.orig;
        this.session.editLevel('goal-region', (l) => {
          (l.goals[d.goal] as any).region = final;
        });
        break;
      }
    }
    this.changed();
  }

  private onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    if (this.enabled && (ev.altKey || this.drag?.kind === 'place')) {
      // rotate while placing / alt-wheel rotates selection
      this.rotate(ev.deltaY > 0 ? 1 : -1, ev.shiftKey);
      return;
    }
    this.scene.zoomAt(Math.exp(-ev.deltaY * 0.0015), { x: ev.clientX - r.left, y: ev.clientY - r.top });
  }

  private snapping(ev: { shiftKey?: boolean; altKey?: boolean }) {
    return this.snap && !ev.altKey;
  }

  private snapMove(ids: string[], dx: number, dy: number, noSnap: boolean): Vec {
    if (ids.length === 1) {
      const o = this.session.find(ids[0]);
      if (o) {
        let x = o.x + dx;
        let y = o.y + dy;
        if (this.snap && !noSnap) {
          x = this.snapV(x);
          y = this.snapV(y);
        }
        const g = this.gearSnap(o, x, y);
        if (g) {
          x = g.x;
          y = g.y;
        }
        return { x: x - o.x, y: y - o.y };
      }
    }
    return this.snap && !noSnap ? { x: this.snapV(dx), y: this.snapV(dy) } : { x: dx, y: dy };
  }

  /** Toothed parts snap to perfect mesh distance when close to another toothed rotor. */
  private gearSnap(o: ObjectDef, x: number, y: number): Vec | null {
    const me = this.buildSim.entities.get(o.id);
    const rotor = me?.rotor;
    if (!rotor || !rotor.teeth) return null;
    const rx = x + (o.flip ? -rotor.x : rotor.x);
    const ry = y + rotor.y;
    let best: Vec | null = null;
    let bd = 18;
    for (const e of this.buildSim.list) {
      if (e.id === o.id || !e.rotor || !e.rotor.teeth) continue;
      if (this.drag?.kind === 'move' && this.selected.has(e.id)) continue;
      const c = e.rotorWorld()!;
      const want = e.rotor.r + rotor.r;
      const dx = rx - c.x;
      const dy = ry - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const err = Math.abs(d - want);
      if (err < bd && err > 0.01) {
        bd = err;
        best = { x: c.x + (dx / d) * want - (rx - x), y: c.y + (dy / d) * want - (ry - y) };
      } else if (err <= 0.01) return { x, y };
    }
    return best;
  }

  private throttledCheck(d: Extract<Drag, { kind: 'move' | 'place' }>) {
    const now = performance.now();
    if (now - d.lastCheck < 70) return;
    d.lastCheck = now;
    this.check(d);
  }

  private check(d: Extract<Drag, { kind: 'move' | 'place' }>) {
    let objs: ObjectDef[];
    let ignore: Set<string>;
    if (d.kind === 'move') {
      objs = d.ids.map((id) => ({ ...this.session.find(id)! })).filter((o) => o.type);
      for (const o of objs) {
        o.x += d.offset.x;
        o.y += d.offset.y;
      }
      ignore = new Set(d.ids);
    } else {
      objs = [{ ...d.obj, x: d.obj.x + d.offset.x, y: d.obj.y + d.offset.y }];
      ignore = new Set([d.obj.id]);
    }
    const bad = invalidPlacements(this.buildSim, objs, ignore);
    d.valid = bad.length === 0;
    this.invalid = new Set(bad);
    for (const o of objs) this.scene.view(o.id)?.setGhost(d.kind === 'place' || !d.valid, d.valid);
  }

  private updateHover(p: Vec) {
    if (this.tool) {
      this.toolHover = this.toolTarget(p)?.pos ?? null;
      this.hover = null;
      this.hoverConn = null;
      if (this.pending) this.pending.cursor = this.toolHover ?? p;
      return;
    }
    const hd = this.handleAt(p);
    if (hd) {
      this.hover = null;
      this.hoverConn = null;
      this.canvas.style.cursor = hd.mode === 'rotate' ? 'grab' : this.resizeCursor(hd.id, hd.mode.axis);
      return;
    }
    const e = this.pick(p);
    this.hover = e?.id ?? null;
    this.hoverConn = e ? null : this.pickConnection(p);
    this.canvas.style.cursor = e && this.editable(e.id) ? 'grab' : this.hoverConn ? 'pointer' : 'default';
  }

  private showMarquee(d: Extract<Drag, { kind: 'box' }>) {
    const r = this.canvas.getBoundingClientRect();
    const a = this.scene.worldToScreen(d.start.x, d.start.y);
    const b = this.scene.worldToScreen(d.now.x, d.now.y);
    Object.assign(this.marquee.style, {
      display: 'block',
      left: `${r.left + Math.min(a.x, b.x)}px`,
      top: `${r.top + Math.min(a.y, b.y)}px`,
      width: `${Math.abs(b.x - a.x)}px`,
      height: `${Math.abs(b.y - a.y)}px`,
    });
  }

  private regionAt(p: Vec): { goal: number; mode: 'move' | 'resize' } | null {
    const goals = this.session.level.goals;
    const order = this.selectedGoal !== null ? [this.selectedGoal, ...goals.keys()] : [...goals.keys()];
    for (const i of order) {
      const g = goals[i] as any;
      if (!g?.region) continue;
      const r = g.region;
      const hr = this.pickRadius(12);
      if (Math.abs(p.x - (r.x + r.w)) < hr && Math.abs(p.y - (r.y + r.h)) < hr) return { goal: i, mode: 'resize' };
      // grab the zone only by its border or when it is the selected goal
      const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
      const nearEdge = inside && (p.x - r.x < hr || r.x + r.w - p.x < hr || p.y - r.y < hr || r.y + r.h - p.y < hr);
      if (nearEdge || (inside && i === this.selectedGoal && !this.pick(p))) return { goal: i, mode: 'move' };
    }
    return null;
  }

  // ------------------------------------------------------------------ rotate / resize handles

  /** Handles for the selected part, or null when none apply (several selected, locked, a tool is active...). */
  handles(): TransformHandles | null {
    if (!this.enabled || this.tool || this.selected.size !== 1) return null;
    const d = this.drag;
    if (d && d.kind !== 'reshape') return null;
    const id = [...this.selected][0];
    if (!this.editable(id)) return null;
    const o = this.session.find(id);
    const def = o && getComponent(o.type);
    if (!o || !def) return null;
    const canResize = !!def.resize?.w || !!def.resize?.h;
    if (!def.rotatable && !canResize) return null;
    const { w, h } = def.size(o.props ?? {});
    const a = o.angle || 0;
    const u = { x: Math.cos(a), y: Math.sin(a) };
    const v = { x: -Math.sin(a), y: Math.cos(a) };
    const at = (lx: number, ly: number): Vec => ({ x: o.x + u.x * lx + v.x * ly, y: o.y + u.y * lx + v.y * ly });
    const z = Math.max(0.3, this.scene.zoom);
    const resize: TransformHandles['resize'] = [];
    if (def.resize?.w) resize.push({ pos: at(w / 2, 0), axis: 'w', sign: 1 }, { pos: at(-w / 2, 0), axis: 'w', sign: -1 });
    if (def.resize?.h) resize.push({ pos: at(0, h / 2), axis: 'h', sign: 1 }, { pos: at(0, -h / 2), axis: 'h', sign: -1 });
    const rotate = def.rotatable ? { pos: at(0, -h / 2 - ROT_HANDLE_GAP / z), base: at(0, -h / 2) } : null;
    return { center: { x: o.x, y: o.y }, rotate, resize, u, v };
  }

  private handleAt(p: Vec): { id: string; mode: 'rotate' | { axis: 'w' | 'h'; sign: 1 | -1 } } | null {
    const hs = this.handles();
    if (!hs || this.drag) return null;
    const id = [...this.selected][0];
    const r = this.pickRadius(11);
    if (hs.rotate && Math.hypot(p.x - hs.rotate.pos.x, p.y - hs.rotate.pos.y) < r) return { id, mode: 'rotate' };
    for (const q of hs.resize) if (Math.hypot(p.x - q.pos.x, p.y - q.pos.y) < r) return { id, mode: { axis: q.axis, sign: q.sign } };
    return null;
  }

  private resizeCursor(id: string, axis: 'w' | 'h') {
    const o = this.session.find(id);
    let deg = (((o?.angle || 0) * 180) / Math.PI + (axis === 'h' ? 90 : 0)) % 180;
    if (deg < 0) deg += 180;
    return deg < 22.5 || deg >= 157.5 ? 'ew-resize' : deg < 67.5 ? 'nwse-resize' : deg < 112.5 ? 'ns-resize' : 'nesw-resize';
  }

  private applyShape(o: ObjectDef, s: Shape) {
    o.x = s.x;
    o.y = s.y;
    o.angle = s.angle;
    o.props = { ...s.props };
  }

  /** Live preview of a handle drag: edits the document object in place (restored on release). */
  private reshapeTo(d: Extract<Drag, { kind: 'reshape' }>, p: Vec, noSnap: boolean) {
    const o = this.session.find(d.id);
    const def = o && getComponent(o.type);
    if (!o || !def) return;
    const snap = this.snap && !noSnap;
    const next: Shape = { ...d.orig, props: { ...d.orig.props } };
    if (d.mode === 'rotate') {
      let a = Math.atan2(p.y - d.orig.y, p.x - d.orig.x) - d.grab;
      const step = def.rotationStep ?? ROT_STEP;
      if (snap) a = Math.round(a / step) * step;
      else a = Math.round((a * 180) / Math.PI) * (Math.PI / 180);
      next.angle = Math.atan2(Math.sin(a), Math.cos(a));
    } else {
      const key = def.resize?.[d.mode.axis];
      const spec = def.props.find((q) => q.key === key);
      if (!key || !spec || spec.type !== 'number') return;
      const L0 = Number(d.orig.props[key] ?? spec.default);
      const a = d.orig.angle;
      const axis = d.mode.axis === 'w' ? { x: Math.cos(a), y: Math.sin(a) } : { x: -Math.sin(a), y: Math.cos(a) };
      // distance from the fixed (opposite) edge to the pointer, along the part's own axis
      const along = ((p.x - d.orig.x) * axis.x + (p.y - d.orig.y) * axis.y) * d.mode.sign + L0 / 2;
      const step = snap ? spec.step : 1;
      const L = Math.min(spec.max, Math.max(spec.min, Math.round(along / step) * step));
      const shift = ((L - L0) / 2) * d.mode.sign;
      next.x = d.orig.x + axis.x * shift;
      next.y = d.orig.y + axis.y * shift;
      next.props[key] = L;
    }
    const same = next.x === o.x && next.y === o.y && next.angle === (o.angle || 0) && JSON.stringify(next.props) === JSON.stringify(o.props ?? {});
    if (same) return;
    d.changed = next.x !== d.orig.x || next.y !== d.orig.y || next.angle !== d.orig.angle || JSON.stringify(next.props) !== JSON.stringify(d.orig.props);
    if (d.mode === 'rotate' && next.angle !== (o.angle || 0)) this.fb.sfx('uiHover', { vol: 0.35, pitch: 1.4 });
    this.applyShape(o, next);
    this.rebuild();
    const now = performance.now();
    if (now - d.lastCheck >= 70) {
      d.lastCheck = now;
      this.checkReshape(d, next);
    } else this.scene.view(d.id)?.setGhost(!d.valid, d.valid);
  }

  private checkReshape(d: Extract<Drag, { kind: 'reshape' }>, s: Shape) {
    const o = this.session.find(d.id);
    if (!o) return;
    const cand: ObjectDef = { ...o, x: s.x, y: s.y, angle: s.angle, props: { ...s.props } };
    const bad = invalidPlacements(this.buildSim, [cand], new Set([d.id]));
    d.valid = bad.length === 0;
    this.invalid = new Set(bad);
    this.scene.view(d.id)?.setGhost(!d.valid, d.valid);
  }

  // ------------------------------------------------------------------ placing from the bin

  beginPlace(type: string, ev: { clientX: number; clientY: number }) {
    this.cancel();
    if (type === 'rope' || type === 'belt' || type === 'wire') {
      this.setTool(type);
      return;
    }
    const ok = this.session.canPlace(type);
    if (!ok.ok) {
      this.fb.sfx('error');
      this.fb.toast(ok.reason ?? 'Can’t place that.', 'warn');
      return;
    }
    const p = this.world(ev);
    const obj = this.session.makeObject(type, this.snapV(p.x), this.snapV(p.y));
    this.rebuild([obj]);
    this.drag = { kind: 'place', obj, sticky: false, offset: { x: 0, y: 0 }, valid: true, lastCheck: 0, overCanvas: false };
    this.scene.view(obj.id)?.setGhost(true, true);
    const v = this.scene.view(obj.id);
    if (v) v.root.setAlpha(0);
    this.selected = new Set();
    this.fb.sfx('pickup', { vol: 0.7 });
    this.changed();
  }

  private finishPlace(d: Extract<Drag, { kind: 'place' }>) {
    this.check(d);
    if (!d.overCanvas) return;
    if (!d.valid) {
      this.fb.sfx('error');
      this.fb.toast('That spot is taken — parts can’t overlap.', 'warn');
      return;
    }
    const obj = { ...d.obj, x: Math.round((d.obj.x + d.offset.x) * 10) / 10, y: Math.round((d.obj.y + d.offset.y) * 10) / 10 };
    this.drag = null;
    this.invalid.clear();
    if (this.session.addObject(obj)) {
      this.selected = new Set([obj.id]);
      this.fb.sfx('place');
    } else {
      this.rebuild();
      this.fb.sfx('error');
    }
    this.changed();
  }

  get placing() {
    return this.drag?.kind === 'place' ? this.drag.obj.type : null;
  }

  // ------------------------------------------------------------------ connection tools

  setTool(t: ToolKind | null) {
    if (t && t !== 'wire') {
      const ok = this.session.canPlace(t);
      if (!ok.ok) {
        this.fb.sfx('error');
        this.fb.toast(ok.reason ?? 'None left.', 'warn');
        return;
      }
    }
    this.tool = t;
    this.pending = null;
    this.toolHover = null;
    this.selected.clear();
    this.selectedConn = null;
    if (t) {
      this.fb.sfx('ui');
      this.fb.toast(
        t === 'rope'
          ? 'Rope: click a hook point, click pulleys to route over them, then click the other end.'
          : t === 'belt'
            ? 'Belt: click two wheels (motor, gear, pulley or conveyor drive).'
            : 'Wire: click an orange OUT socket, then a cyan IN socket.',
      );
    }
    this.canvas.style.cursor = t ? 'crosshair' : 'default';
    this.changed();
  }

  private toolTarget(p: Vec): { pos: Vec; ref: PortRef; entity: Entity; wheel?: boolean; dir?: 'in' | 'out' } | null {
    const sim = this.buildSim;
    let best: { pos: Vec; ref: PortRef; entity: Entity; wheel?: boolean; dir?: 'in' | 'out' } | null = null;
    let bd = Infinity;
    const consider = (pos: Vec, r: number, cand: Omit<NonNullable<typeof best>, 'pos'>) => {
      const d = Math.hypot(pos.x - p.x, pos.y - p.y);
      if (d < r && d < bd) {
        bd = d;
        best = { pos, ...cand };
      }
    };
    for (const e of sim.list) {
      if (this.tool === 'rope') {
        for (const a of e.anchors) {
          const pos = e.anchorWorld(a.id)!;
          if (a.id === 'wheel') {
            if (this.pending) consider(pos, this.pickRadius(26), { ref: { obj: e.id, port: a.id }, entity: e, wheel: true });
          } else consider(pos, this.pickRadius(16), { ref: { obj: e.id, port: a.id }, entity: e });
        }
      } else if (this.tool === 'belt' && e.rotor) {
        consider(e.rotorWorld()!, e.rotor.r + this.pickRadius(10), { ref: { obj: e.id, port: 'rotor' }, entity: e });
      } else if (this.tool === 'wire') {
        for (const port of e.ports) {
          if (this.pending && this.pending.portDir === port.dir) continue;
          consider(e.portWorld(port.id)!, this.pickRadius(14), { ref: { obj: e.id, port: port.id }, entity: e, dir: port.dir });
        }
      }
    }
    return best;
  }

  private toolClick(p: Vec) {
    const t = this.toolTarget(p);
    if (!t) {
      if (this.pending) this.fb.sfx('uiHover');
      return;
    }
    const tool = this.tool!;
    if (!this.pending) {
      if (tool === 'rope' && t.wheel) return;
      this.pending = { kind: tool, points: [t.pos], cursor: p, from: t.ref, via: [], portDir: t.dir };
      this.fb.sfx('click');
      this.changed();
      return;
    }
    const pend = this.pending;
    if (tool === 'rope' && t.wheel) {
      if (!pend.via.includes(t.ref.obj)) {
        pend.via.push(t.ref.obj);
        pend.points.push(t.pos);
        this.fb.sfx('click', { pitch: 1.2 });
      }
      this.changed();
      return;
    }
    if (t.ref.obj === pend.from!.obj && (tool !== 'rope' || t.ref.port === pend.from!.port)) {
      this.fb.sfx('error');
      return;
    }
    const conn = { kind: tool, from: pend.from!, to: t.ref, via: tool === 'rope' ? pend.via : undefined };
    const why = this.session.connectionBlockReason(conn);
    const ok = !why && this.session.addConnection(conn);
    if (ok) this.fb.sfx('connect');
    else {
      this.fb.sfx('error');
      this.fb.toast(why ?? 'Couldn’t connect those.', 'warn');
    }
    this.pending = null;
    this.tool = null;
    this.toolHover = null;
    this.canvas.style.cursor = 'default';
    this.changed();
  }

  // ------------------------------------------------------------------ commands

  cancel() {
    if (this.drag?.kind === 'reshape') {
      const o = this.session.find(this.drag.id);
      if (o) this.applyShape(o, this.drag.orig);
      this.drag = null;
      this.rebuild();
    }
    if (this.drag?.kind === 'place') {
      this.drag = null;
      this.rebuild();
    }
    this.drag = null;
    this.invalid.clear();
    this.marquee.style.display = 'none';
    if (this.tool || this.pending) {
      this.tool = null;
      this.pending = null;
      this.toolHover = null;
      this.canvas.style.cursor = 'default';
    }
    this.changed();
  }

  deselect() {
    this.selected.clear();
    this.selectedConn = null;
    this.changed();
  }

  rotate(dir: number, fine = false) {
    const step = fine || !this.snap ? Math.PI / 180 : ROT_STEP;
    if (this.drag?.kind === 'place') {
      const d = this.drag;
      const def = getComponent(d.obj.type);
      if (!def?.rotatable) return;
      d.obj = { ...d.obj, angle: (d.obj.angle || 0) + dir * (def.rotationStep && !fine ? def.rotationStep : step) };
      const off = d.offset;
      this.rebuild([d.obj]);
      const v = this.scene.view(d.obj.id);
      if (v) {
        v.dragOffset = off;
        v.setGhost(true, true);
      }
      this.fb.sfx('rotate');
      return;
    }
    const ids = [...this.selected].filter((id) => this.editable(id));
    if (!ids.length) return;
    let any = false;
    for (const id of ids) {
      const def = getComponent(this.session.find(id)!.type);
      const st = def?.rotationStep && !fine ? def.rotationStep : step;
      if (this.session.rotateObjects([id], dir * st)) any = true;
    }
    if (any) {
      const bad = invalidPlacements(this.buildSim, ids.map((id) => this.session.find(id)!).filter(Boolean), new Set(ids));
      if (bad.length) {
        this.session.undo();
        this.fb.sfx('error');
        this.fb.toast('No room to rotate there.', 'warn');
        return;
      }
      this.fb.sfx('rotate');
    }
  }

  flip() {
    if (this.drag?.kind === 'place') {
      const d = this.drag;
      if (!getComponent(d.obj.type)?.flippable) return;
      d.obj = { ...d.obj, flip: d.obj.flip ? undefined : true };
      const off = d.offset;
      this.rebuild([d.obj]);
      const v = this.scene.view(d.obj.id);
      if (v) {
        v.dragOffset = off;
        v.setGhost(true, true);
      }
      this.fb.sfx('rotate');
      return;
    }
    const ids = [...this.selected].filter((id) => this.editable(id));
    if (ids.length && this.session.flipObjects(ids)) {
      const bad = invalidPlacements(this.buildSim, ids.map((id) => this.session.find(id)!), new Set(ids));
      if (bad.length) {
        this.session.undo();
        this.fb.sfx('error');
        this.fb.toast('No room to flip there.', 'warn');
        return;
      }
      this.fb.sfx('rotate');
    }
  }

  deleteSelection() {
    if (this.selectedConn) {
      if (!this.connectionEditable(this.selectedConn)) {
        this.fb.sfx('error');
        this.fb.toast('That connection is part of the level.', 'warn');
        return;
      }
      this.session.removeConnection(this.selectedConn);
      this.selectedConn = null;
      this.fb.sfx('disconnect');
      return;
    }
    const ids = [...this.selected].filter((id) => this.editable(id));
    if (!ids.length) {
      if (this.selected.size) {
        this.fb.sfx('error');
        this.fb.toast('That part is bolted down — it belongs to the level.', 'warn');
      }
      return;
    }
    this.session.deleteObjects(ids);
    this.selected.clear();
    this.fb.sfx('delete');
  }

  copy() {
    const ids = [...this.selected].filter((id) => this.editable(id));
    this.clipboard = this.session.copy(ids);
    if (this.clipboard) this.fb.sfx('click');
  }

  paste(dx = 30, dy = 30) {
    if (!this.clipboard) return;
    // offset the paste until it fits
    for (let k = 1; k < 8; k++) {
      const objs = this.clipboard.objects.map((o) => ({ ...o, x: o.x + dx * k, y: o.y + dy * k }));
      if (invalidPlacements(this.buildSim, objs, new Set()).length === 0) {
        const ids = this.session.paste(this.clipboard, dx * k, dy * k);
        if (ids) {
          this.selected = new Set(ids);
          this.fb.sfx('place');
        } else {
          this.fb.sfx('error');
          this.fb.toast('Not enough of those left in the bin.', 'warn');
        }
        this.changed();
        return;
      }
    }
    this.fb.sfx('error');
    this.fb.toast('No room to paste.', 'warn');
  }

  duplicate() {
    this.copy();
    this.paste();
  }

  nudge(dx: number, dy: number) {
    const ids = [...this.selected].filter((id) => this.editable(id));
    if (!ids.length) return;
    const objs = ids.map((id) => ({ ...this.session.find(id)! })).map((o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
    if (invalidPlacements(this.buildSim, objs, new Set(ids)).length) {
      this.fb.sfx('error');
      return;
    }
    this.session.moveObjects(ids, dx, dy);
  }

  selectAll() {
    this.selected = new Set(this.session.editableObjects().map((o) => o.id));
    this.changed();
  }

  /** The single selected object (editable or not), for the properties panel. */
  get primary(): { obj: ObjectDef; entity: Entity | undefined; editable: boolean } | null {
    if (this.selected.size !== 1) return null;
    const id = [...this.selected][0];
    const obj = this.session.find(id);
    if (!obj) return null;
    return { obj, entity: this.buildSim.entities.get(id), editable: this.editable(id) };
  }
}
