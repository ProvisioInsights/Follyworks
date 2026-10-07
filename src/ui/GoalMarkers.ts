// Numbered goal tags drawn in the room, next to the thing each goal is about: "1 Rubber ball
// here", "2 Fill this 1/3". They match the numbered goal chips in the top bar, follow their
// targets every frame, and tick over to a check mark when the goal is met. Each tag takes the
// nearby spot that covers the least of the space the player needs (game/tagPlacement.ts), and
// tags fade while a part is being placed or dragged so they never hide a drop spot.

import type { BuildDef } from '../core/types';
import { buildSpots, partRects } from '../game/goalTags';
import type { PlayController } from '../game/PlayController';
import { placeTag, spotRect as spotRectFor, type Rect, type TagSpot } from '../game/tagPlacement';
import type { WorkshopScene } from '../render/WorkshopScene';
import { goalMarker } from '../sim/goals';
import { h, icon } from './dom';

export interface GoalMarkerHost {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  ctl: PlayController;
  scene: WorkshopScene;
  /** Reference solution: its part spots are kept clear of tags. */
  solution?: BuildDef | null;
}

type Tag = { el: HTMLElement; text: HTMLElement; detail: HTMLElement; num: HTMLElement; key: string; spot: TagSpot | null };

export class GoalMarkers {
  private host: GoalMarkerHost;
  private layer: HTMLElement;
  private tags: Tag[] = [];
  /** World rects of the solution's parts, recomputed when the level changes (editor). */
  private spots: { level: unknown; rects: Rect[] } = { level: null, rects: [] };
  /** Inputs of the last placement; tags only move when the view, the build or a label changes. */
  private placedKey = '';
  private unhook: () => void;
  visible = true;

  constructor(host: GoalMarkerHost) {
    this.host = host;
    this.layer = h('div', { class: 'goal-tags', 'aria-hidden': 'true' });
    host.root.prepend(this.layer);
    this.unhook = host.scene.onFrame(() => this.update());
  }

  destroy() {
    this.unhook();
    this.layer.remove();
  }

  private sync(n: number) {
    while (this.tags.length < n) {
      const num = h('span', { class: 'n' });
      const text = h('span', { class: 't' });
      const detail = h('span', { class: 'd' });
      const el = h('div', { class: 'goal-tag' }, num, text, detail);
      this.layer.append(el);
      this.tags.push({ el, text, detail, num, key: '', spot: null });
    }
    while (this.tags.length > n) this.tags.pop()!.el.remove();
  }

  update() {
    const ctl = this.host.ctl;
    const goals = ctl.session.level.goals;
    this.layer.style.display = this.visible ? '' : 'none';
    this.sync(goals.length);
    if (!this.visible || !goals.length) return;
    const running = ctl.mode === 'run';
    const sim = running && ctl.run ? ctl.run.sim : ctl.editor.buildSim;
    const scene = this.host.scene;
    const c = this.host.canvas.getBoundingClientRect();
    const r = this.host.root.getBoundingClientRect();
    const ox = c.left - r.left;
    const oy = c.top - r.top;
    const ed = ctl.editor;
    this.layer.classList.toggle('busy', !running && !!(ed.placing || ed.drag));
    const markers = goals.map((g, i) => goalMarker(g, sim, running ? sim.goals.status[i] : undefined));
    goals.forEach((_, i) => {
      const tag = this.tags[i];
      const m = markers[i];
      const met = running && !!sim.goals.status[i]?.met;
      const key = `${i}|${met}|${m.text}|${m.detail ?? ''}`;
      if (tag.key !== key) {
        tag.key = key;
        tag.num.replaceChildren(met ? icon('check', 12) : document.createTextNode(String(i + 1)));
        tag.text.textContent = m.text;
        tag.detail.textContent = m.detail ?? '';
        tag.detail.style.display = m.detail ? '' : 'none';
        tag.el.classList.toggle('met', met);
      }
      tag.el.classList.toggle('focus', ctl.focusGoal === i);
    });

    // Choose spots in build mode (the room is still); a run keeps them so tags don't dance.
    const cam = scene.cameras.main;
    const level = ctl.session.level;
    const sizes = this.tags.map((t) => `${t.el.offsetWidth}x${t.el.offsetHeight}`).join(',');
    const key = `${cam.zoom.toFixed(3)}|${Math.round(cam.worldView.x)}|${Math.round(cam.worldView.y)}|${ctl.session.version}|${sizes}|${c.width}x${c.height}`;
    if (!running && key !== this.placedKey) {
      this.placedKey = key;
      if (this.spots.level !== level) this.spots = { level, rects: buildSpots(level, this.host.solution) };
      const toScreen = (q: Rect): Rect => {
        const a = scene.worldToScreen(q.x, q.y);
        return { x: a.x + ox, y: a.y + oy, w: q.w * cam.zoom, h: q.h * cam.zoom };
      };
      const ins = scene.insets;
      const view = { x: ox + ins.left, y: oy + ins.top, w: c.width - ins.left - ins.right, h: c.height - ins.top - ins.bottom };
      const obstacles = { buildSpots: this.spots.rects.map(toScreen), parts: partRects(sim).map(toScreen), tags: [] as Rect[], view };
      markers.forEach((m, i) => {
        const tag = this.tags[i];
        if (!m.at) return;
        const s = scene.worldToScreen(m.at.x, m.at.y);
        const p = placeTag({ x: s.x + ox, y: s.y + oy }, tag.el.offsetWidth || 120, tag.el.offsetHeight || 26, obstacles);
        tag.spot = p.spot;
        obstacles.tags.push(p.rect);
      });
    }

    markers.forEach((m, i) => {
      const tag = this.tags[i];
      if (!m.at) {
        tag.el.style.display = 'none';
        return;
      }
      const s = scene.worldToScreen(m.at.x, m.at.y);
      const x = s.x + ox;
      const y = s.y + oy;
      const inside = x > ox && x < ox + c.width && y > oy + 20 && y < oy + c.height;
      tag.el.style.display = inside ? '' : 'none';
      const w = tag.el.offsetWidth || 120;
      const h = tag.el.offsetHeight || 26;
      const spot = tag.spot ?? { side: 'up' as const, dx: 0, dy: 0 };
      const rect = spotRectFor({ x, y }, w, h, spot);
      tag.el.dataset.side = spot.side;
      // the arrow keeps pointing at the anchor when the tag slides sideways or stacks
      tag.el.style.setProperty('--ax', `${Math.round(x - rect.x)}px`);
      tag.el.style.setProperty('--ay', `${Math.round(Math.min(h - 8, Math.max(8, y - rect.y)))}px`);
      tag.el.style.transform = `translate(${Math.round(rect.x)}px, ${Math.round(rect.y)}px)`;
    });
  }
}
