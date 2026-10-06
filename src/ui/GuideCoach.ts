// Optional step-by-step tutorial guidance: a card with the current instruction, a bouncing arrow
// at the parts-bin entry or HUD control it talks about, and (through PlayController.guideOverlay)
// a glowing outline in the room showing one good place for the part. It only ever suggests.

import { blankLevel } from '../core/level';
import type { GuideStep, LevelDef } from '../core/types';
import type { PlayController } from '../game/PlayController';
import { currentGuideStep, type GuideProgress } from '../game/guide';
import type { Entity } from '../sim/Entity';
import { Simulation } from '../sim/Simulation';
import { append, clear, h, icon } from './dom';

export interface GuideHost {
  root: HTMLElement;
  ctl: PlayController;
  /** The DOM element a step points at ('bin:<type>' or 'hud:<name>'), if it is on screen. */
  target: (key: string) => HTMLElement | null;
  /** Whether guidance starts visible (the player's setting). */
  enabled: boolean;
  onToggle: (visible: boolean) => void;
  sfx: () => void;
}

/** Builds the outline of a ghost part with the real collision geometry. */
const ghostEntities = (level: LevelDef, step: GuideStep): Entity[] => {
  if (!step.ghost) return [];
  const probe = blankLevel('guide-ghost');
  probe.world = { ...level.world };
  const g = step.ghost;
  try {
    const sim = new Simulation(probe, { objects: [{ id: 'ghost', type: g.type, x: g.x, y: g.y, angle: g.angle ?? 0, flip: g.flip, props: g.props ?? {} }], connections: [] }, { lenient: true });
    return sim.list.filter((e) => e.alive);
  } catch {
    return [];
  }
};

export class GuideCoach {
  private steps: GuideStep[];
  private host: GuideHost;
  private level: LevelDef;
  private progress: GuideProgress = { ran: false, acked: new Set() };
  private index = -1;
  visible: boolean;
  private card: HTMLElement;
  private arrow: HTMLElement;
  private ghosts: Entity[] = [];
  private lastTarget: HTMLElement | null = null;

  constructor(level: LevelDef, host: GuideHost) {
    this.level = level;
    this.steps = level.guide ?? [];
    this.host = host;
    this.visible = host.enabled;
    this.card = h('div', { class: 'panel guide-card', role: 'status', 'aria-live': 'polite' });
    this.arrow = h('div', { class: 'guide-arrow', 'aria-hidden': 'true' });
    host.root.append(this.card, this.arrow);
  }

  get active() {
    return this.steps.length > 0;
  }

  get finished() {
    return this.index >= this.steps.length;
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.index = -1;
    this.update();
  }

  /** Call whenever the build, mode or layout may have changed. */
  update() {
    const ctl = this.host.ctl;
    if (ctl.mode === 'run') this.progress.ran = true;
    const i = currentGuideStep(this.steps, ctl.session.build, this.progress);
    const show = this.visible && i < this.steps.length && ctl.mode === 'build';
    if (i !== this.index) {
      this.index = i;
      this.ghosts = i < this.steps.length ? ghostEntities(this.level, this.steps[i]) : [];
      this.renderCard();
      if (show && i > 0) this.host.sfx();
    }
    this.card.style.display = show ? 'flex' : 'none';
    const step = show ? this.steps[i] : null;
    ctl.guideOverlay = step ? { ghosts: this.ghosts, point: step.point && 'world' in step.point ? step.point.world : null } : null;
    this.placeArrow(step);
  }

  private renderCard() {
    const c = this.card;
    clear(c);
    const i = this.index;
    if (i >= this.steps.length) return;
    const step = this.steps[i];
    append(c, [
      h('div', { class: 'guide-step' }, `${i + 1}/${this.steps.length}`),
      h('div', { class: 'guide-text' }, step.text),
      step.until.kind === 'ack'
        ? h('button', { class: 'btn small primary', onClick: () => (this.progress.acked.add(i), this.update()) }, 'Got it')
        : null,
      h('button', { class: 'btn small ghost', onClick: () => this.host.onToggle(false), tip: 'Hide the step-by-step guide (bring it back with the compass button)' }, 'Hide guide'),
    ]);
  }

  private placeArrow(step: GuideStep | null) {
    const a = this.arrow;
    const p = step?.point;
    const key = p && 'bin' in p ? `bin:${p.bin}` : p && 'hud' in p ? `hud:${p.hud}` : null;
    const el = key ? this.host.target(key) : null;
    if (this.lastTarget && this.lastTarget !== el) this.lastTarget.classList.remove('guide-glow');
    this.lastTarget = el;
    if (!el || !step) {
      a.style.display = 'none';
      return;
    }
    el.classList.add('guide-glow');
    const r = el.getBoundingClientRect();
    if (r.width === 0) {
      a.style.display = 'none';
      return;
    }
    const rootR = this.host.root.getBoundingClientRect();
    a.style.display = 'block';
    clear(a);
    a.append(icon('back') as unknown as Node);
    // Bin entries sit on the left edge: point at them from the right. HUD controls sit at the top
    // or bottom of the screen: point from the room side.
    if (key!.startsWith('bin:')) {
      a.dataset.dir = 'left';
      a.style.left = `${r.right - rootR.left + 6}px`;
      a.style.top = `${r.top - rootR.top + r.height / 2 - 18}px`;
    } else if (r.top > rootR.height / 2) {
      a.dataset.dir = 'down';
      a.style.left = `${r.left - rootR.left + r.width / 2 - 18}px`;
      a.style.top = `${r.top - rootR.top - 44}px`;
    } else {
      a.dataset.dir = 'up';
      a.style.left = `${r.left - rootR.left + r.width / 2 - 18}px`;
      a.style.top = `${r.bottom - rootR.top + 8}px`;
    }
  }

  destroy() {
    this.lastTarget?.classList.remove('guide-glow');
    this.host.ctl.guideOverlay = null;
    this.card.remove();
    this.arrow.remove();
  }
}
