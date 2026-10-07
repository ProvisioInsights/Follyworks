// A small floating toolbar next to the selection (turn left / right, flip, duplicate, delete),
// and the angle / length badge that follows the pointer while a part is being turned or
// stretched. Both are DOM over the canvas, repositioned every frame so they follow camera pan
// and zoom, kept inside the free stage area (never over the parts bin, top bar or dock), and
// hidden during runs.

import type { PlayController } from '../game/PlayController';
import type { WorkshopScene } from '../render/WorkshopScene';
import { h, iconBtn } from './dom';

export interface SelectionBarHost {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  ctl: PlayController;
  scene: WorkshopScene;
}

/** The bar's buttons turn by at least this much (parts with a coarser own step use theirs). */
const BAR_TURN = Math.PI / 12;
/** Screen gap between the selection (or its rotate knob) and the bar. */
const GAP = 12;
/** Height of the rotate knob above a part, in screen px (ROT_HANDLE_GAP + knob radius). */
const KNOB_ROOM = 42;
/** The same with a finger: the knob sits further out and draws a size up (see EditorController). */
const KNOB_ROOM_TOUCH = 62;

type Rect = { l: number; t: number; r: number; b: number };

export class SelectionBar {
  private host: SelectionBarHost;
  readonly el: HTMLElement;
  private badge: HTMLElement;
  private btns: Record<'rotL' | 'rotR' | 'flip' | 'dup' | 'del', HTMLElement>;
  private unhook: () => void;
  private key = '';

  constructor(host: SelectionBarHost) {
    this.host = host;
    const ed = () => host.ctl.editor;
    this.btns = {
      rotL: iconBtn('rotateL', 'Turn left 15° <kbd>Q</kbd>', () => ed().rotate(-1, false, BAR_TURN)),
      rotR: iconBtn('rotate', 'Turn right 15° <kbd>E</kbd>', () => ed().rotate(1, false, BAR_TURN)),
      flip: iconBtn('flip', 'Flip <kbd>F</kbd>', () => ed().flip()),
      dup: iconBtn('copy', 'Duplicate <kbd>Ctrl</kbd>+<kbd>D</kbd>', () => ed().duplicate()),
      del: iconBtn('trash', 'Delete <kbd>Del</kbd>', () => ed().deleteSelection()),
    };
    this.btns.del.classList.add('danger');
    this.el = h('div', { class: 'panel sel-bar', role: 'toolbar', 'aria-label': 'Selected part' }, ...Object.values(this.btns));
    // keep keyboard focus on the stage so shortcuts keep working after a click here
    this.el.addEventListener('pointerdown', (e) => e.preventDefault());
    this.badge = h('div', { class: 'manip-badge', 'aria-hidden': 'true' });
    this.el.style.display = 'none';
    this.badge.style.display = 'none';
    host.root.append(this.el, this.badge);
    this.unhook = host.scene.onFrame(() => this.update());
  }

  destroy() {
    this.unhook();
    this.el.remove();
    this.badge.remove();
  }

  /** The stage area the HUD leaves free, relative to the root element. */
  private freeRect(): Rect {
    const c = this.host.canvas.getBoundingClientRect();
    const r = this.host.root.getBoundingClientRect();
    const i = this.host.scene.insets;
    return { l: c.left - r.left + i.left, t: c.top - r.top + i.top, r: c.right - r.left - i.right, b: c.bottom - r.top - i.bottom };
  }

  private toRoot(x: number, y: number) {
    const c = this.host.canvas.getBoundingClientRect();
    const r = this.host.root.getBoundingClientRect();
    const s = this.host.scene.worldToScreen(x, y);
    return { x: s.x + c.left - r.left, y: s.y + c.top - r.top };
  }

  update() {
    const { ctl } = this.host;
    const ed = ctl.editor;
    const building = ctl.mode === 'build' && ed.enabled;
    this.updateBadge(building);
    const ids = building && !ed.tool && !ed.drag ? [...ed.selected].filter((id) => ed.editable(id)) : [];
    const sel = ids.length ? this.selectionRect(ids) : null;
    if (!sel) {
      this.el.style.display = 'none';
      return;
    }
    // which buttons apply to this selection
    const types = ids.map((id) => ctl.session.find(id)?.type ?? '');
    const key = types.join(',');
    if (key !== this.key) {
      this.key = key;
      const defs = ctl.editor.buildSim.list.filter((e) => ids.includes(e.id)).map((e) => e.def);
      const rot = defs.some((d) => d.rotatable);
      this.btns.rotL.style.display = rot ? '' : 'none';
      this.btns.rotR.style.display = rot ? '' : 'none';
      this.btns.flip.style.display = defs.some((d) => d.flippable) ? '' : 'none';
    }
    this.el.style.display = '';
    const bw = this.el.offsetWidth;
    const bh = this.el.offsetHeight;
    const free = this.freeRect();
    const cx = (sel.l + sel.r) / 2;
    const cy = (sel.t + sel.b) / 2;
    const knob = ed.handles()?.rotate ? (ed.touch ? KNOB_ROOM_TOUCH : KNOB_ROOM) : 0;
    const candidates = [
      { x: cx - bw / 2, y: sel.t - knob - GAP - bh },
      { x: cx - bw / 2, y: sel.b + GAP },
      { x: sel.r + GAP, y: cy - bh / 2 },
      { x: sel.l - GAP - bw, y: cy - bh / 2 },
    ];
    const fits = (p: { x: number; y: number }) => p.x >= free.l && p.y >= free.t && p.x + bw <= free.r && p.y + bh <= free.b;
    // prefer a spot that also leaves the neighbouring parts visible
    const others = this.otherRects(ids);
    const clear = (p: { x: number; y: number }) => !others.some((o) => p.x < o.r && o.l < p.x + bw && p.y < o.b && o.t < p.y + bh);
    let at = candidates.find((p) => fits(p) && clear(p)) ?? candidates.find(fits);
    if (!at) {
      // nothing fits cleanly (a huge part, or zoomed right in): clamp the first choice into the stage
      const p = candidates[0];
      at = { x: Math.min(Math.max(p.x, free.l), free.r - bw), y: Math.min(Math.max(p.y, free.t), free.b - bh) };
    }
    // hide rather than float over the HUD when the selection has left the stage
    const visible = sel.r > free.l && sel.l < free.r && sel.b > free.t && sel.t < free.b && free.r - free.l > bw;
    this.el.style.display = visible ? '' : 'none';
    this.el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
  }

  /** Screen rectangles of the parts that are not selected (the room's walls excluded: they are big). */
  private otherRects(ids: string[]): Rect[] {
    const out: Rect[] = [];
    for (const e of this.host.ctl.editor.buildSim.list) {
      if (ids.includes(e.id) || !e.bodies.length || e.def.type === 'wall') continue;
      const r = this.selectionRect([e.id]);
      if (r) out.push(r);
    }
    return out;
  }

  /** Screen rectangle around the given parts' bodies. */
  private selectionRect(ids: string[]): Rect | null {
    const sim = this.host.ctl.editor.buildSim;
    let rect: Rect | null = null;
    const add = (x: number, y: number) => {
      const p = this.toRoot(x, y);
      if (!rect) rect = { l: p.x, t: p.y, r: p.x, b: p.y };
      else {
        rect.l = Math.min(rect.l, p.x);
        rect.r = Math.max(rect.r, p.x);
        rect.t = Math.min(rect.t, p.y);
        rect.b = Math.max(rect.b, p.y);
      }
    };
    for (const id of ids) {
      const e = sim.entities.get(id);
      if (!e) continue;
      if (!e.bodies.length) {
        const o = this.host.ctl.session.find(id);
        if (o) add(o.x, o.y);
        continue;
      }
      for (const b of e.bodies) {
        add(b.bounds.min.x, b.bounds.min.y);
        add(b.bounds.max.x, b.bounds.max.y);
      }
    }
    return rect;
  }

  /** "30°", "240 cm" or "30° · 240 cm" next to the pointer while turning or stretching. */
  private updateBadge(building: boolean) {
    const m = building ? this.host.ctl.editor.manip : null;
    if (!m) {
      this.badge.style.display = 'none';
      return;
    }
    const parts: string[] = [];
    if (m.deg !== null) parts.push(`${Number.isInteger(m.deg) ? m.deg : m.deg.toFixed(1)}°`);
    if (m.length) parts.push(`${Math.round(m.length.value)}${m.length.unit ? ` ${m.length.unit}` : ''}`);
    const text = parts.join(' · ');
    if (this.badge.textContent !== text) this.badge.textContent = text;
    this.badge.classList.toggle('snapped', !!m.guide);
    this.badge.style.display = '';
    const p = this.toRoot(m.pointer.x, m.pointer.y);
    const free = this.freeRect();
    const w = this.badge.offsetWidth;
    const hh = this.badge.offsetHeight;
    // below-right of the pointer, flipped to the other side near the stage edges
    let x = p.x + 18;
    let y = p.y + 20;
    if (x + w > free.r) x = p.x - 18 - w;
    if (y + hh > free.b) y = p.y - 20 - hh;
    x = Math.min(Math.max(x, free.l), free.r - w);
    y = Math.min(Math.max(y, free.t), free.b - hh);
    this.badge.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
