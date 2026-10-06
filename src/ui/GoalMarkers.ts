// Numbered goal tags drawn in the room, next to the thing each goal is about: "1 Rubber ball
// here", "2 Fill this 1/3". They match the numbered goal chips in the top bar, follow their
// targets every frame, and tick over to a check mark when the goal is met.

import type { PlayController } from '../game/PlayController';
import type { WorkshopScene } from '../render/WorkshopScene';
import { goalMarker } from '../sim/goals';
import { h, icon } from './dom';

export interface GoalMarkerHost {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  ctl: PlayController;
  scene: WorkshopScene;
}

export class GoalMarkers {
  private host: GoalMarkerHost;
  private layer: HTMLElement;
  private tags: { el: HTMLElement; text: HTMLElement; detail: HTMLElement; num: HTMLElement; key: string }[] = [];
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
      this.tags.push({ el, text, detail, num, key: '' });
    }
    while (this.tags.length > n) this.tags.pop()!.el.remove();
  }

  update() {
    const ctl = this.host.ctl;
    const goals = ctl.session.level.goals;
    this.layer.style.display = this.visible ? '' : 'none';
    this.sync(goals.length);
    if (!this.visible || !goals.length) return;
    const sim = ctl.mode === 'run' && ctl.run ? ctl.run.sim : ctl.editor.buildSim;
    const c = this.host.canvas.getBoundingClientRect();
    const r = this.host.root.getBoundingClientRect();
    // goals that share a spot (three balls into one skip) stack their tags instead of hiding each other
    const placed: { x: number; y: number }[] = [];
    goals.forEach((g, i) => {
      const tag = this.tags[i];
      const st = ctl.mode === 'run' ? sim.goals.status[i] : undefined;
      const m = goalMarker(g, sim, st);
      const met = !!st?.met;
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
      if (!m.at) {
        tag.el.style.display = 'none';
        return;
      }
      const s = this.host.scene.worldToScreen(m.at.x, m.at.y);
      const x = s.x + c.left - r.left;
      let y = s.y + c.top - r.top;
      const ax = x;
      const ay = y;
      y -= 27 * placed.filter((q) => Math.abs(q.x - ax) < 40 && Math.abs(q.y - ay) < 14).length;
      placed.push({ x: ax, y: ay });
      const inside = x > c.left - r.left && x < c.right - r.left && y > c.top - r.top + 20 && y < c.bottom - r.top;
      tag.el.style.display = inside ? '' : 'none';
      tag.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    });
  }
}
