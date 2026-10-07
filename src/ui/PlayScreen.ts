// The in-game HUD around one PlayController: top bar with goals, parts bin, edit tools,
// transport dock with timeline, properties panel, briefing, hints and results.

import { describeMiss } from '../sim/goals';
import type { AppContext } from '../app/context';
import type { SfxName } from '../audio/AudioEngine';
import { CONNECTION_TOOLS, isToolType } from '../components';
import { CATEGORY_LABELS, getComponent, paletteComponents, type Category, type PropSpec } from '../components/registry';
import type { BuildDef, GoalDef, LevelDef } from '../core/types';
import { ENVIRONMENT_IDS } from '../core/level';
import type { SessionKind } from '../editor/Session';
import { PlayController } from '../game/PlayController';
import { invalidPlacements } from '../game/placement';
import type { AttemptResult } from '../game/scoring';
import type { Difficulty } from '../game/difficulty';
import { applyHintPenalty, ghostEntities, GHOST_TIER, HintLadder, hintTierLabel, type HintView } from '../game/hints';
import type { Entity } from '../sim/Entity';
import { THEMES, type ThemeId, type ThemeSetting } from '../core/themes';
import { paintIcon } from '../render/art/parts';
import { skinCanvas } from '../render/skin';
import { goalLabel, goalMarker } from '../sim/goals';
import type { Simulation } from '../sim/Simulation';
import { append, clear, h, icon, iconBtn, modal, plural, toast } from './dom';
import { EditorPanel } from './EditorPanel';
import { GoalMarkers } from './GoalMarkers';
import { SelectionBar } from './SelectionBar';
import { GuideCoach } from './GuideCoach';
import { conceptsInRun } from '../content/runConcepts';
import type { ConceptId } from '../content/science';
import { physicsInMachine, scienceSection } from './science';
import { difficultyBadge } from './difficulty';

export interface PlayConfig {
  kind: SessionKind;
  level: LevelDef;
  build: BuildDef;
  title: string;
  subtitle: string;
  /** Show the level briefing card on entry. */
  brief?: boolean;
  /** Extra content shown at the top of the briefing card (Physics Lab lesson intros). */
  briefIntro?: () => HTMLElement;
  /** Concepts the level is about (a Physics Lab lesson's idea), listed first under "Physics in your machine". */
  concepts?: ConceptId[];
  onExit: () => void;
  onNext?: () => void;
  /** Label of the results card's next button (default "Next puzzle"). */
  nextLabel?: string;
  /** Called with the attempt; return true if this was a first solve (for messaging). */
  onSolved?: (r: AttemptResult) => void;
  onBuildChanged?: (build: BuildDef, level: LevelDef) => void;
  /** Level editor: launch a test run of the current level. */
  onTest?: (level: LevelDef) => void;
  /** Test mode: return to the editor. */
  onReturn?: () => void;
  exitLabel?: string;
  sandbox?: { onSave: (name: string, build: BuildDef, env: string) => void; onLoad: () => void; onEnv: (env: string) => void };
  /** Campaign: the difficulty this level was derived for (a read-only badge in the HUD, briefing and results; set in Settings). */
  difficulty?: Difficulty;
  /** Reference solution for the hint ladder's parts list and ghosts (campaign only). */
  solution?: BuildDef | null;
  /** Sandbox / editor: a theme picker in the top bar for this visit. */
  theme?: { value: () => ThemeSetting; set: (t: ThemeSetting) => void };
}

/** Painted parts-bin icons per theme (small canvases; drawn synchronously from the cache). */
const iconCache = new Map<string, HTMLCanvasElement>();
const iconFor = (type: string, theme: ThemeId = 'modern', size = 112): HTMLCanvasElement => {
  const key = `${type}:${size}:${theme}`;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  let src = iconCache.get(key);
  if (!src) {
    try {
      src = skinCanvas(paintIcon(type, {}, size), theme, type, size / 56, true);
      iconCache.set(key, src);
    } catch {
      return c; // art not available: leave blank
    }
  }
  ctx.drawImage(src, 0, 0, size, size);
  return c;
};

const SPEEDS = [
  { v: 1, label: '1×' },
  { v: 0.5, label: '½×' },
  { v: 0.25, label: '¼×' },
];

const GOAL_ICONS: Record<GoalDef['kind'], string> = {
  enterRegion: 'target',
  containerCount: 'box',
  height: 'up',
  activate: 'bolt',
  destroyed: 'boom',
  contact: 'link',
};

/** Goals about the goofy parts get their own chip icon (a cat, a bell, a pin, a hoop). */
const PART_GOAL_ICONS: Record<string, string> = { cat: 'cat', bell: 'bell', bowling_pin: 'pin', candle: 'flame', basketball_hoop: 'hoop', rubber_chicken: 'chicken', teapot: 'flame', toaster: 'bolt' };
const goalIcon = (g: GoalDef, level: LevelDef): string => {
  const objs = [...level.fixedObjects, ...level.startingObjects];
  const sel = g.kind === 'activate' ? g.target : null;
  const type =
    g.kind === 'containerCount' ? objs.find((o) => o.id === g.container)?.type : sel && 'type' in sel ? sel.type : sel && 'id' in sel ? objs.find((o) => o.id === sel.id)?.type : undefined;
  return (type && PART_GOAL_ICONS[type]) || GOAL_ICONS[g.kind];
};

export class PlayScreen {
  readonly root: HTMLDivElement;
  readonly ctl: PlayController;
  private app: AppContext;
  private cfg: PlayConfig;
  private els: Record<string, HTMLElement> = {};
  private raf = 0;
  private lastVersion = -1;
  private lastSelKey = '';
  private binFilter = '';
  private binCat: Category | 'all' = 'all';
  private hints: HintLadder;
  private hintGhostSet: { n: number; ents: Entity[] } = { n: 0, ents: [] };
  private resultModal: { close: () => void } | null = null;
  private dockRunning: boolean | null = null;
  private timeUpEl: HTMLElement | null = null;
  private editorPanel: EditorPanel | null = null;
  private keyHandler: (e: KeyboardEvent) => void;
  private keyUpHandler: (e: KeyboardEvent) => void;
  private resizeObs: ResizeObserver | null = null;
  private dead = false;
  private guide: GuideCoach | null = null;
  private goalTags: GoalMarkers;
  private selBar: SelectionBar;

  constructor(app: AppContext, cfg: PlayConfig) {
    this.app = app;
    this.cfg = cfg;
    this.hints = new HintLadder(cfg.level.hints, cfg.solution);
    this.root = h('div', { class: 'layer play' });
    app.ui.appendChild(this.root);
    this.ctl = new PlayController(app.scene, app.canvas, {
      kind: cfg.kind,
      level: cfg.level,
      build: cfg.build,
      audio: app.audio,
      feedback: {
        sfx: (n, o) => app.sfx(n, o),
        toast: (m, k) => toast(m, k),
      },
      showForces: () => app.settings.showForces,
      ghostTrails: () => app.settings.ghostTrails,
      onSolved: (r) => this.showResults(r),
      onTimeUp: () => this.showTimeUp(),
      onSettled: () => this.showTimeUp(true),
      onBuildChanged: (b, l) => cfg.onBuildChanged?.(b, l),
    });
    this.ctl.editor.snap = app.settings.snap;
    this.build();
    this.goalTags = new GoalMarkers({ root: this.root, canvas: app.canvas, ctl: this.ctl, scene: app.scene });
    this.selBar = new SelectionBar({ root: this.root, canvas: app.canvas, ctl: this.ctl, scene: app.scene });
    if (cfg.level.guide?.length && (cfg.kind === 'campaign' || cfg.kind === 'test')) {
      this.guide = new GuideCoach(cfg.level, {
        root: this.root,
        ctl: this.ctl,
        enabled: app.settings.guidance,
        target: (key) => this.guideTarget(key),
        onToggle: (v) => this.setGuide(v),
        sfx: () => app.sfx('ui'),
      });
    }
    this.ctl.onChange(() => this.schedule());
    this.keyHandler = (e) => this.onKey(e);
    this.keyUpHandler = (e) => this.onKeyUp(e);
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    this.render(true);
    this.applyInsets();
    if (cfg.brief) this.showBrief();
    else if (cfg.kind === 'campaign' && cfg.level.metadata?.tutorial && !this.guideShowing) this.nextHint(true);
    app.audio.setMusicIntensity(0.3);
  }

  get cfgKind() {
    return this.cfg.kind;
  }

  /** The theme changed: repaint the parts-bin icons (the scene reskins itself). */
  refreshTheme() {
    if (!this.dead) this.renderBin();
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    this.resizeObs?.disconnect();
    this.resultModal?.close();
    this.guide?.destroy();
    this.goalTags.destroy();
    this.selBar.destroy();
    this.ctl.destroy();
    this.editorPanel?.destroy();
    this.root.remove();
  }

  private get session() {
    return this.ctl.session;
  }
  private get editor() {
    return this.ctl.editor;
  }

  private schedule() {
    if (this.raf || this.dead) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.dead) this.render(false);
    });
  }

  // ------------------------------------------------------------------ layout

  private build() {
    const cfg = this.cfg;
    const isEditor = cfg.kind === 'editor';
    // top bar
    const back = h('button', { class: 'btn ghost small', onClick: () => this.exit(), tip: cfg.kind === 'test' ? 'Back to the editor' : 'Leave (your machine is saved)' }, icon('back'), cfg.exitLabel ?? 'Menu');
    const title = h(
      'div',
      { class: 'title' },
      h('span', { class: 't' }, cfg.title, cfg.difficulty ? difficultyBadge(cfg.difficulty, this.app) : null),
      h('span', { class: 'c' }, cfg.subtitle),
    );
    this.els.goals = h('div', { class: 'goals' });
    this.els.goals.addEventListener('pointerleave', () => (this.ctl.focusGoal = null));
    const right = h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } });
    if (cfg.level.guide?.length && (cfg.kind === 'campaign' || cfg.kind === 'test'))
      right.append((this.els.guideBtn = iconBtn('map', 'Step-by-step guide on/off', () => this.setGuide(!this.guide?.visible))));
    if (this.hints.available && cfg.kind !== 'editor') right.append((this.els.hintBtn = iconBtn('bulb', 'Hint <kbd>H</kbd>', () => this.nextHint())));
    if (cfg.sandbox) {
      const sel = h(
        'select',
        { 'aria-label': 'Environment', onChange: (e: Event) => cfg.sandbox!.onEnv((e.target as HTMLSelectElement).value) },
        ...ENVIRONMENT_IDS.map((id) =>
          h('option', { value: id, selected: cfg.level.environment === id }, id[0].toUpperCase() + id.slice(1)),
        ),
      );
      right.append(
        sel,
        h('button', { class: 'btn small', onClick: () => this.sandboxSave() }, 'Save'),
        h('button', { class: 'btn small', onClick: () => cfg.sandbox!.onLoad() }, 'Load'),
      );
    }
    if (cfg.theme) {
      const pick = h(
        'select',
        { 'aria-label': 'Theme', tip: 'Theme for this visit (Settings sets it everywhere)', onChange: (e: Event) => cfg.theme!.set((e.target as HTMLSelectElement).value as ThemeSetting) },
        h('option', { value: 'auto', selected: cfg.theme.value() === 'auto' }, 'Theme: as Settings'),
        ...THEMES.map((t) => h('option', { value: t.id, selected: cfg.theme!.value() === t.id }, t.name)),
      );
      right.append(pick);
    }
    if (isEditor && cfg.onTest)
      right.append(h('button', { class: 'btn go small', onClick: () => cfg.onTest!(this.session.level), tip: 'Play your level exactly as a player would' }, icon('play'), 'Test'));
    right.append(
      (this.els.mute = iconBtn(this.app.settings.muted ? 'mute' : 'sound', 'Sound on/off <kbd>M</kbd>', () => this.toggleMute())),
      iconBtn('info', 'Controls', () => this.showControls()),
      iconBtn('gear', 'Settings', () => this.app.openSettings()),
    );
    this.root.append(h('div', { class: 'topbar' }, back, title, this.els.goals, right));

    // parts bin
    this.els.binList = h('div', { class: 'bin-list scroll' });
    this.els.binFoot = h('div', { class: 'bin-foot' });
    const many = this.session.unlimited || this.session.inventory().length > 8;
    const search = many
      ? h(
          'div',
          { class: 'bin-search' },
          h('input', {
            type: 'search',
            placeholder: 'Search parts…',
            'aria-label': 'Search parts',
            onInput: (e: Event) => {
              this.binFilter = (e.target as HTMLInputElement).value.toLowerCase();
              this.renderBin();
            },
          }),
        )
      : null;
    this.els.binCats = h('div', { class: 'bin-cats' });
    this.els.bin = h(
      'div',
      { class: 'panel bin' },
      h('div', { class: 'bin-head' }, h('span', { class: 'label' }, 'Parts bin'), h('span', { class: 'muted', style: { fontSize: '12px' } }, 'drag or click')),
      search,
      many ? this.els.binCats : null,
      this.els.binList,
      this.els.binFoot,
    );
    // Left column: parts bin with the selected part's properties docked underneath, so neither
    // ever covers the machine.
    this.els.leftCol = h('div', { class: 'leftcol' }, this.els.bin);
    this.root.append(this.els.leftCol);

    // edit tools
    this.els.tools = h(
      'div',
      { class: 'panel tools' },
      (this.els.undo = iconBtn('undo', 'Undo <kbd>Ctrl</kbd>+<kbd>Z</kbd>', () => this.session.undo())),
      (this.els.redo = iconBtn('redo', 'Redo <kbd>Ctrl</kbd>+<kbd>Y</kbd>', () => this.session.redo())),
      h('div', { class: 'sep' }),
      (this.els.rotL = iconBtn('rotateL', 'Rotate left <kbd>Q</kbd> (hold <kbd>Shift</kbd> for 1°)', (e) => this.editor.rotate(-1, e.shiftKey))),
      (this.els.rotR = iconBtn('rotate', 'Rotate right <kbd>E</kbd>', (e) => this.editor.rotate(1, e.shiftKey))),
      (this.els.flip = iconBtn('flip', 'Flip <kbd>F</kbd>', () => this.editor.flip())),
      (this.els.dup = iconBtn('copy', 'Duplicate <kbd>Ctrl</kbd>+<kbd>D</kbd>', () => this.editor.duplicate())),
      (this.els.del = iconBtn('trash', 'Delete <kbd>Del</kbd>', () => this.editor.deleteSelection())),
      h('div', { class: 'sep' }),
      (this.els.snap = iconBtn('grid', 'Snap to grid <kbd>G</kbd> (hold <kbd>Alt</kbd> while dragging to ignore)', () => this.toggleSnap())),
      iconBtn('fit', 'Fit view <kbd>0</kbd> · scroll to zoom, right-drag to pan', () => this.app.scene.resetView()),
      (this.els.trailBtn = iconBtn('trail', 'Ghost trails from your last run', () => {
        this.app.updateSettings({ ghostTrails: !this.app.settings.ghostTrails });
        this.render(true);
      })),
      (this.els.forceBtn = iconBtn('forces', 'Show physics shapes and motion', () => {
        this.app.updateSettings({ showForces: !this.app.settings.showForces });
        this.render(true);
      })),
    );
    this.root.append(this.els.tools);

    // dock
    this.els.runBtn = h('button', { class: 'btn go big run-btn', onClick: () => this.ctl.toggleRun(), tip: 'Run / Reset <kbd>Space</kbd>' });
    this.els.pause = iconBtn('pause', 'Pause / resume <kbd>P</kbd>', () => this.togglePause());
    this.els.step = iconBtn('step', 'Step one frame <kbd>.</kbd>', () => this.ctl.run?.stepOnce());
    const rew = iconBtn('rewind', 'Hold to rewind <kbd>←</kbd>', () => {});
    rew.addEventListener('pointerdown', () => this.ctl.run?.setRewinding(true));
    const stopRew = () => this.ctl.run?.setRewinding(false);
    rew.addEventListener('pointerup', stopRew);
    rew.addEventListener('pointerleave', stopRew);
    this.els.rew = rew;
    this.els.speed = h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': 'Speed' },
      SPEEDS.map((s) =>
        h('button', { 'data-v': s.v, onClick: () => this.setSpeed(s.v), tip: s.v === 1 ? 'Normal speed <kbd>1</kbd>' : s.v === 0.5 ? 'Slow motion <kbd>2</kbd>' : 'Super slow <kbd>3</kbd>' }, s.label),
      ),
    );
    const range = h('input', { type: 'range', min: '0', max: '1', step: '1', value: '0', 'aria-label': 'Timeline' }) as HTMLInputElement;
    range.addEventListener('pointerdown', () => this.ctl.run?.beginScrub());
    range.addEventListener('input', () => this.ctl.run?.scrubTo(Number(range.value)));
    range.addEventListener('change', () => this.ctl.run?.endScrub());
    range.addEventListener('pointerup', () => this.ctl.run?.endScrub());
    this.els.range = range;
    this.els.clock = h('span', { class: 'clock' }, '0.0s');
    this.els.timeline = h('div', { class: 'timeline' }, range, this.els.clock);
    this.els.chain = h('div', { class: 'chain', tip: 'Distinct things that happened in this run' }, h('b', null, '0'), h('span', null, 'chain'));
    this.els.limit = h('span', { class: 'pill' });
    this.els.runControls = h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, this.els.pause, this.els.step, this.els.rew, this.els.speed, this.els.timeline, h('div', { class: 'sep' }), this.els.chain);
    this.els.buildInfo = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, this.els.limit);
    this.els.dock = h('div', { class: 'panel dock' }, this.els.runBtn, h('div', { class: 'sep' }), this.els.runControls, this.els.buildInfo);
    this.root.append(this.els.dock);

    // properties
    this.els.props = h('div', { class: 'panel props scroll', style: { display: 'none' } });
    this.els.leftCol.append(this.els.props);

    if (isEditor) this.editorPanel = new EditorPanel(this.app, this.ctl, this.root);

    this.els.tip = h('div', { class: 'panel tipbar', style: { display: 'none' } });
    this.root.append(this.els.tip);

    this.resizeObs = new ResizeObserver(() => this.applyInsets());
    this.resizeObs.observe(this.els.bin);
    this.resizeObs.observe(document.body);
  }

  private applyInsets() {
    this.guide?.update();
    const bin = this.els.leftCol.getBoundingClientRect();
    const right = this.cfg.kind === 'editor' ? 320 : 20;
    this.app.scene.setInsets({ top: 58, left: bin.right + 6, right, bottom: 78 });
    this.placeDock();
  }

  /** Keep the dock centred, unless that would cover the edit tools (narrow windows): then sit just right of them. */
  private placeDock() {
    const dock = this.els.dock;
    dock.style.left = '';
    dock.style.transform = '';
    if (this.els.tools.style.display === 'none') return;
    const t = this.els.tools.getBoundingClientRect();
    const d = dock.getBoundingClientRect();
    if (d.left < t.right + 10) {
      dock.style.left = `${t.right + 10}px`;
      dock.style.transform = 'none';
    }
  }

  // ------------------------------------------------------------------ rendering

  private render(force: boolean) {
    const ctl = this.ctl;
    const running = ctl.mode === 'run';
    const run = ctl.run;
    if (!running && this.timeUpEl) {
      this.timeUpEl.remove();
      this.timeUpEl = null;
    }
    // run button
    const rb = this.els.runBtn;
    clear(rb);
    rb.className = `btn big run-btn ${running ? 'stop' : 'go'}`;
    rb.append(icon(running ? 'reset' : 'play'), running ? 'Reset' : 'Run');
    this.els.runControls.style.display = running ? 'flex' : 'none';
    this.els.buildInfo.style.display = running ? 'none' : 'flex';
    this.els.tools.style.display = running ? 'none' : 'flex';
    if (running !== this.dockRunning) {
      this.dockRunning = running;
      this.placeDock();
    }
    this.els.binList.style.opacity = running ? '0.55' : '1';
    this.els.bin.style.pointerEvents = running ? 'none' : 'auto';
    const lim = this.session.level.restrictions?.timeLimit;
    this.els.limit.textContent = this.cfg.kind === 'sandbox' ? 'Sandbox' : lim ? `Time limit ${lim}s` : 'No time limit';
    if (run) {
      clear(this.els.pause);
      this.els.pause.append(icon(run.paused ? 'play' : 'pause'));
      this.els.pause.classList.toggle('on', run.paused);
      const range = this.els.range as HTMLInputElement;
      range.min = String(run.minTick);
      range.max = String(Math.max(run.minTick + 1, run.maxTick));
      if (!run.scrubbing) range.value = String(run.sim.tick);
      this.els.clock.textContent = `${run.sim.time.toFixed(1)}s`;
      (this.els.chain.firstChild as HTMLElement).textContent = String(run.sim.chain.length);
      for (const b of Array.from(this.els.speed.children) as HTMLElement[]) b.classList.toggle('on', Number(b.dataset.v) === run.speed);
    }
    this.renderGoals();
    // edit tool states
    const ed = this.editor;
    const editableSel = [...ed.selected].some((id) => ed.editable(id));
    (this.els.undo as HTMLButtonElement).disabled = !this.session.canUndo;
    (this.els.redo as HTMLButtonElement).disabled = !this.session.canRedo;
    for (const k of ['rotL', 'rotR', 'flip', 'dup']) (this.els[k] as HTMLButtonElement).disabled = !editableSel && !ed.placing;
    (this.els.del as HTMLButtonElement).disabled = !editableSel && !(ed.selectedConn && ed.connectionEditable(ed.selectedConn));
    this.els.snap.classList.toggle('on', ed.snap);
    this.els.trailBtn.classList.toggle('on', this.app.settings.ghostTrails);
    this.els.forceBtn.classList.toggle('on', this.app.settings.showForces);
    if (force || this.session.version !== this.lastVersion) {
      this.lastVersion = this.session.version;
      this.renderBin();
      this.lastSelKey = '';
    }
    this.highlightBin();
    const selKey = running ? 'run' : `${[...ed.selected].join(',')}|${ed.selectedConn}|${this.session.version}`;
    if (selKey !== this.lastSelKey) {
      this.lastSelKey = selKey;
      this.renderProps();
    }
    this.editorPanel?.render();
    this.els.guideBtn?.classList.toggle('on', !!this.guide?.visible);
    this.guide?.update();
    this.syncHintGhosts();
  }

  /** Ghost outlines revealed by hints, minus any the player has since matched with a real part. */
  private syncHintGhosts() {
    const revealed = this.hints.revealed;
    if (revealed.length !== this.hintGhostSet.n) this.hintGhostSet = { n: revealed.length, ents: ghostEntities(this.session.level, revealed) };
    const keep = new Set(this.hints.visibleGhosts(this.session.build).map((o) => o.id));
    this.ctl.hintGhosts = this.hintGhostSet.ents.filter((e) => keep.has(e.id));
  }

  private get guideShowing() {
    return !!this.guide && this.guide.visible && !this.guide.finished;
  }

  private setGuide(v: boolean) {
    if (!this.guide) return;
    this.app.updateSettings({ guidance: v });
    this.guide.setVisible(v);
    if (v) this.els.tip.style.display = 'none';
    this.render(true);
  }

  private guideTarget(key: string): HTMLElement | null {
    if (key.startsWith('bin:')) return this.els.binList.querySelector<HTMLElement>(`[data-type="${key.slice(4)}"]`);
    const hud: Record<string, HTMLElement | undefined> = {
      'hud:run': this.els.runBtn,
      'hud:reset': this.els.runBtn,
      'hud:rotate': this.els.rotR,
      'hud:flip': this.els.flip,
      'hud:hint': this.els.hintBtn,
    };
    return hud[key] ?? null;
  }

  private renderGoals() {
    const el = this.els.goals;
    const goals = this.session.level.goals;
    const run = this.ctl.run;
    const sim = run?.sim ?? this.editor.buildSim;
    const markers = goals.map((g, i) => goalMarker(g, sim, run?.sim.goals.status[i]));
    const lvl = this.session.level;
    const key = JSON.stringify([goals.map((g) => goalLabel(g, lvl)), run?.sim.goals.status.map((s) => [s.met, Math.round(s.progress * 10)]), markers.map((m) => m.detail)]);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    clear(el);
    if (!goals.length) {
      el.append(h('div', { class: 'goal-chip', style: { borderColor: 'var(--edge)' } }, this.cfg.kind === 'sandbox' ? 'Free play: build whatever you like' : 'No goals yet: add one in the Goals tab'));
      return;
    }
    goals.forEach((g, i) => {
      const st = run?.sim.goals.status[i];
      const met = !!st?.met;
      const detail = markers[i].detail;
      const chip = h(
        'div',
        { class: `goal-chip ${met ? 'met' : ''}`, tip: met ? 'Done!' : `Goal ${i + 1}: ${markers[i].text}. Point here to find it in the room.` },
        h('span', { class: 'dot' }, met ? icon('check', 12) : String(i + 1)),
        h('span', { class: 'gk' }, icon(goalIcon(g, lvl), 14)),
        h('span', { class: 'gl' }, goalLabel(g, lvl)),
        detail ? h('span', { class: 'gd' }, detail) : null,
        st && !met && st.progress > 0 ? h('span', { class: 'bar' }, h('i', { style: { width: `${Math.round(st.progress * 100)}%` } })) : null,
      );
      chip.addEventListener('pointerenter', () => (this.ctl.focusGoal = i));
      chip.addEventListener('pointerleave', () => {
        if (this.ctl.focusGoal === i) this.ctl.focusGoal = null;
      });
      el.append(chip);
    });
  }

  private renderBin() {
    const list = this.els.binList;
    clear(list);
    const rows = this.session.inventory();
    const unlimited = this.session.unlimited;
    // categories for big bins
    const cats = new Set<Category | 'tools'>();
    for (const r of rows) {
      const d = getComponent(r.type);
      cats.add(d ? d.category : 'tools');
    }
    if (this.els.binCats) {
      clear(this.els.binCats);
      const mk = (id: string, label: string) =>
        h(
          'button',
          {
            class: `bin-cat ${this.binCat === id ? 'on' : ''}`,
            onClick: () => {
              this.binCat = id as any;
              this.renderBin();
            },
          },
          label,
        );
      this.els.binCats.append(mk('all', 'All'));
      for (const c of cats) this.els.binCats.append(mk(c, c === 'tools' ? 'Links' : CATEGORY_LABELS[c as Category]));
    }
    let shown = 0;
    for (const r of rows) {
      const def = getComponent(r.type);
      const tool = isToolType(r.type) ? CONNECTION_TOOLS[r.type] : null;
      const name = def?.name ?? tool?.name ?? r.type;
      const desc = def?.description ?? tool?.description ?? '';
      const cat = def ? def.category : 'tools';
      if (this.binCat !== 'all' && cat !== this.binCat) continue;
      if (this.binFilter && !`${name} ${desc} ${def?.tags.join(' ') ?? ''}`.toLowerCase().includes(this.binFilter)) continue;
      shown++;
      const empty = r.remaining === 0;
      const item = h(
        'button',
        {
          class: `bin-item ${empty ? 'empty' : ''}`,
          'data-type': r.type,
          tip: `<b>${name}</b><br>${desc}${empty ? '<br><i>None left</i>' : ''}`,
          'aria-label': `${name}${r.remaining >= 0 ? `, ${r.remaining} left` : ''}`,
        },
        iconFor(r.type, this.app.scene.currentTheme),
        h('span', { class: 'n' }, name),
        unlimited || r.remaining < 0 ? null : h('span', { class: 'count' }, String(r.remaining)),
      );
      item.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        this.editor.beginPlace(r.type, e);
        this.schedule();
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          const c = this.app.canvas.getBoundingClientRect();
          this.editor.beginPlace(r.type, { clientX: (c.left + c.right) / 2, clientY: (c.top + c.bottom) / 2 });
        }
      });
      list.append(item);
    }
    if (!shown) list.append(h('div', { class: 'muted', style: { gridColumn: '1 / -1', padding: '10px', fontSize: '13px' } }, rows.length ? 'Nothing matches.' : 'This puzzle gives you nothing to add. Rearranging is not allowed either. Just press Run?'));
    const max = this.session.level.restrictions?.maxParts;
    const used = this.session.build.objects.length + this.session.build.connections.filter((c) => c.kind !== 'wire').length;
    this.els.binFoot.textContent = unlimited ? 'Unlimited parts' : max !== undefined ? `Parts used: ${used} / ${max}` : `Parts placed: ${used}`;
  }

  private highlightBin() {
    const active = this.editor.placing ?? this.editor.tool;
    for (const el of Array.from(this.els.binList.children) as HTMLElement[]) el.classList.toggle('active', !!active && el.dataset.type === active);
  }

  private renderProps() {
    const el = this.els.props;
    clear(el);
    const ed = this.editor;
    if (this.ctl.mode === 'run') {
      el.style.display = 'none';
      return;
    }
    if (ed.selectedConn) {
      const c = this.session.allConnections().find((q) => q.id === ed.selectedConn);
      if (!c) return void (el.style.display = 'none');
      const tool = CONNECTION_TOOLS[c.kind];
      const editable = ed.connectionEditable(c.id);
      el.style.display = 'flex';
      el.append(h('h3', null, tool.name), h('div', { class: 'desc' }, tool.description));
      if (c.kind === 'rope' && editable) {
        const slack = Number(c.props?.slack ?? 0);
        const val = h('span', { class: 'val' }, `${slack}`);
        const inp = h('input', { type: 'range', min: '-40', max: '200', step: '5', value: String(slack) }) as HTMLInputElement;
        inp.addEventListener('input', () => (val.textContent = inp.value));
        inp.addEventListener('change', () => this.session.setConnectionProp(c.id, 'slack', Number(inp.value)));
        el.append(h('div', { class: 'row' }, h('div', { class: 'line' }, h('span', null, 'Slack (negative = taut)'), val), inp));
      }
      if (editable) el.append(h('div', { class: 'actions' }, h('button', { class: 'btn small', onClick: () => ed.deleteSelection() }, icon('trash'), 'Remove')));
      else el.append(h('div', { class: 'lock-note' }, icon('lock', 16), 'Part of the level'));
      return;
    }
    const p = ed.primary;
    if (!p) {
      if (ed.selected.size > 1) {
        el.style.display = 'flex';
        el.append(h('h3', null, `${ed.selected.size} parts`), h('div', { class: 'desc' }, 'Drag to move them together. Rotate, flip, duplicate or delete with the tools below.'));
      } else el.style.display = 'none';
      return;
    }
    const def = getComponent(p.obj.type);
    if (!def) return void (el.style.display = 'none');
    el.style.display = 'flex';
    append(el, [h('h3', null, def.name), h('div', { class: 'desc' }, def.description), def.help ? h('div', { class: 'desc muted' }, def.help) : null, scienceSection(def.type)]);
    if (!p.editable) {
      el.append(h('div', { class: 'lock-note' }, icon('lock', 16), this.session.isFixed(p.obj.id) ? 'Bolted down: part of the room' : 'Part of the puzzle: it can’t be moved'));
      return;
    }
    for (const spec of def.props) el.append(this.propRow(p.obj.id, spec, p.obj.props?.[spec.key]));
    if (this.session.editsLevel) {
      const fixed = this.session.isFixed(p.obj.id);
      const cb = h('input', { type: 'checkbox', checked: fixed }) as HTMLInputElement;
      cb.addEventListener('change', () => this.session.setScenery(p.obj.id, cb.checked));
      el.append(h('label', { class: 'line', style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' } }, cb, 'Room scenery (otherwise a starting part)'));
    }
    const actions = h('div', { class: 'actions' });
    if (def.rotatable) actions.append(iconBtn('rotateL', 'Rotate left <kbd>Q</kbd>', (e) => ed.rotate(-1, e.shiftKey)), iconBtn('rotate', 'Rotate right <kbd>E</kbd>', (e) => ed.rotate(1, e.shiftKey)));
    if (def.flippable) actions.append(iconBtn('flip', 'Flip <kbd>F</kbd>', () => ed.flip()));
    actions.append(iconBtn('copy', 'Duplicate', () => ed.duplicate()), iconBtn('trash', 'Delete', () => ed.deleteSelection()));
    el.append(actions);
    if (def.rotatable) {
      const deg = Math.round(((p.obj.angle || 0) * 180) / Math.PI);
      el.append(h('div', { class: 'muted', style: { fontSize: '12px' } }, `Angle ${deg}°`));
    }
  }

  private propRow(id: string, spec: PropSpec, raw: unknown) {
    if (spec.type === 'number') {
      const v = typeof raw === 'number' ? raw : spec.default;
      const val = h('span', { class: 'val' }, `${v}${spec.unit ? ` ${spec.unit}` : ''}`);
      const inp = h('input', { type: 'range', min: String(spec.min), max: String(spec.max), step: String(spec.step), value: String(v), 'aria-label': spec.label }) as HTMLInputElement;
      inp.addEventListener('input', () => (val.textContent = `${inp.value}${spec.unit ? ` ${spec.unit}` : ''}`));
      inp.addEventListener('change', () => {
        if (this.session.setProp(id, spec.key, Number(inp.value))) this.checkAfterEdit(id);
      });
      return h('div', { class: 'row' }, h('div', { class: 'line' }, h('span', null, spec.label), val), inp);
    }
    if (spec.type === 'bool') {
      const cb = h('input', { type: 'checkbox', checked: raw === undefined ? spec.default : !!raw }) as HTMLInputElement;
      cb.addEventListener('change', () => this.session.setProp(id, spec.key, cb.checked));
      return h('label', { class: 'row' }, h('div', { class: 'line' }, h('span', null, spec.label), cb));
    }
    const sel = h('select', { 'aria-label': spec.label }, spec.options.map((o) => h('option', { value: o.value, selected: (raw ?? spec.default) === o.value }, o.label))) as HTMLSelectElement;
    sel.addEventListener('change', () => {
      if (this.session.setProp(id, spec.key, sel.value)) this.checkAfterEdit(id);
    });
    return h('div', { class: 'row' }, h('div', { class: 'line' }, h('span', null, spec.label), sel));
  }

  /** A size change from the panel can make a part overlap its neighbours; undo it if so. */
  private checkAfterEdit(id: string) {
    const o = this.session.find(id);
    if (!o) return;
    if (invalidPlacements(this.editor.buildSim, [o], new Set([id])).length) {
      this.session.undo();
      this.app.sfx('error');
      toast('No room to make it that size.', 'warn');
    }
  }

  // ------------------------------------------------------------------ actions

  private togglePause() {
    const r = this.ctl.run;
    if (!r) return;
    if (r.timedOut) return;
    r.setPaused(!r.paused);
    this.app.sfx('click');
    this.render(false);
  }

  private setSpeed(v: number) {
    if (!this.ctl.run) return;
    this.ctl.run.speed = v;
    this.app.sfx('click', { pitch: v === 1 ? 1 : v === 0.5 ? 0.8 : 0.65 });
    this.render(false);
  }

  private toggleSnap() {
    this.editor.snap = !this.editor.snap;
    this.app.updateSettings({ snap: this.editor.snap });
    this.app.sfx('click');
    this.render(false);
  }

  private toggleMute() {
    const m = !this.app.settings.muted;
    this.app.updateSettings({ muted: m });
    clear(this.els.mute);
    this.els.mute.append(icon(m ? 'mute' : 'sound'));
  }

  private exit() {
    if (this.cfg.kind === 'test' && this.cfg.onReturn) this.cfg.onReturn();
    else this.cfg.onExit();
  }

  /** Climb the hint ladder one step (game/hints.ts). `auto` hints (tutorial entry) are not counted as used. */
  private nextHint(auto = false) {
    const v = this.hints.next(this.session.build, auto);
    if (!v) return;
    this.syncHintGhosts();
    this.renderHint(v);
    this.app.sfx('ui');
  }

  private renderHint(v: HintView) {
    const tip = this.els.tip;
    clear(tip);
    tip.style.display = 'flex';
    tip.dataset.tier = String(v.tier);
    tip.dataset.kind = v.kind;
    // In guided tutorials the guide card sits where the hint bar goes: stack the hint under it.
    const card = this.guideShowing ? this.root.querySelector<HTMLElement>('.guide-card') : null;
    tip.style.top = card ? `${card.getBoundingClientRect().bottom - this.root.getBoundingClientRect().top + 8}px` : '';
    const nameOf = (type: string) => getComponent(type)?.name ?? (isToolType(type) ? CONNECTION_TOOLS[type].name : type);
    let body: Node;
    if (v.kind === 'nudge') body = h('span', { class: 'hint-text' }, v.text);
    else if (v.kind === 'parts')
      body = h(
        'span',
        { class: 'hint-parts' },
        h('span', { class: 'hint-text' }, 'Parts you’ll need:'),
        v.parts.map((p) => h('span', { class: 'hint-part', 'data-type': p.type, tip: nameOf(p.type) }, iconFor(p.type, this.app.scene.currentTheme, 64), h('b', null, `×${p.count}`), h('small', null, nameOf(p.type)))),
        v.wires ? h('span', { class: 'muted', style: { fontSize: '12px' } }, `+ ${plural(v.wires, 'wire')} (free)`) : null,
      );
    else if (v.kind === 'ghost') body = h('span', { class: 'hint-text' }, `A ${nameOf(v.ghost.type).toLowerCase()} goes on the glowing outline (${v.shown} of ${v.of} parts shown).`);
    else body = h('span', { class: 'hint-text' }, v.text);
    const next = this.hints.nextKind(this.session.build);
    const nextLabel = next === 'nudge' ? 'More' : next === 'parts' ? 'Parts you’ll need' : next === 'ghost' ? (this.hints.tierUsed < GHOST_TIER ? 'Show a spot (no ELEGANT)' : 'Show another spot') : null;
    append(tip, [
      icon('bulb') as unknown as Node,
      h('span', { class: 'hint-tier muted', style: { fontSize: '12px' } }, v.kind === 'nudge' ? (v.of > 1 ? `Hint ${v.index + 1}/${v.of}` : 'Hint') : v.kind === 'parts' ? 'Hint · parts' : 'Hint · ghost'),
      h('span', { style: { flex: '1', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, body),
      nextLabel ? h('button', { class: 'btn small ghost hint-more', onClick: () => this.nextHint() }, nextLabel) : null,
      iconBtn('close', 'Hide', () => (tip.style.display = 'none')),
    ]);
  }

  private sandboxSave() {
    const input = h('input', { type: 'text', value: this.cfg.title === 'Sandbox' ? '' : this.cfg.title, placeholder: 'My magnificent contraption', style: { width: '100%' } }) as HTMLInputElement;
    modal(this.app.ui, {
      title: 'Save contraption',
      body: [h('div', { class: 'field' }, h('span', { class: 'label' }, 'Name'), input)],
      actions: [
        { label: 'Cancel', onClick: () => {} },
        {
          label: 'Save',
          kind: 'primary',
          onClick: () => {
            this.cfg.sandbox!.onSave(input.value.trim() || 'Untitled contraption', this.session.level.startingObjects.length ? this.session.build : this.session.build, this.session.level.environment);
            toast('Saved to this browser.');
          },
        },
      ],
    });
    setTimeout(() => input.focus(), 50);
  }

  // ------------------------------------------------------------------ keyboard

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') && (t as HTMLInputElement).type !== 'range') return;
    if (document.querySelector('.modal-back')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const ed = this.editor;
    const running = this.ctl.mode === 'run';
    const k = e.key;
    let handled = true;
    if (k === ' ' || e.code === 'Space') {
      if (e.repeat) return e.preventDefault();
      // space-drag pans only when the pointer is held; a tap toggles run
      this.ctl.toggleRun();
    } else if (k === 'Escape') {
      if (running) this.ctl.reset();
      else if (ed.tool || ed.placing) ed.cancel();
      else ed.deselect();
    } else if (ctrl && (k === 'z' || k === 'Z')) {
      if (running) return;
      if (e.shiftKey) this.session.redo();
      else this.session.undo();
    } else if (ctrl && (k === 'y' || k === 'Y')) {
      if (!running) this.session.redo();
    } else if (ctrl && (k === 'c' || k === 'C')) {
      if (!running) ed.copy();
    } else if (ctrl && (k === 'v' || k === 'V')) {
      if (!running) ed.paste();
    } else if (ctrl && (k === 'd' || k === 'D')) {
      if (!running) ed.duplicate();
    } else if (ctrl && (k === 'a' || k === 'A')) {
      if (!running) ed.selectAll();
    } else if (ctrl) {
      handled = false;
    } else if (k === 'Delete' || k === 'Backspace') {
      if (!running) ed.deleteSelection();
    } else if (k === 'q' || k === 'Q') {
      if (!running) ed.rotate(-1, e.shiftKey);
    } else if (k === 'e' || k === 'E') {
      if (!running) ed.rotate(1, e.shiftKey);
    } else if (k === 'r' || k === 'R') {
      if (!running) ed.resetAngle();
    } else if (k === 'f' || k === 'F') {
      if (!running) ed.flip();
    } else if (k === 'g' || k === 'G') {
      this.toggleSnap();
    } else if (k === 'h' || k === 'H') {
      this.nextHint();
    } else if (k === 'm' || k === 'M') {
      this.toggleMute();
    } else if (k === '0' || k === 'Home') {
      this.app.scene.resetView();
    } else if (k === 'p' || k === 'P') {
      this.togglePause();
    } else if (k === '.' || k === '>') {
      this.ctl.run?.stepOnce();
    } else if (running && (k === '1' || k === '2' || k === '3')) {
      this.setSpeed(SPEEDS[Number(k) - 1].v);
    } else if (k === 'ArrowLeft') {
      if (running) this.ctl.run?.setRewinding(true);
      else ed.nudge(e.shiftKey ? -10 : -1, 0);
    } else if (k === 'ArrowRight') {
      if (running) this.ctl.run?.stepOnce();
      else ed.nudge(e.shiftKey ? 10 : 1, 0);
    } else if (k === 'ArrowUp') {
      if (!running) ed.nudge(0, e.shiftKey ? -10 : -1);
    } else if (k === 'ArrowDown') {
      if (!running) ed.nudge(0, e.shiftKey ? 10 : 1);
    } else handled = false;
    if (handled) e.preventDefault();
  }

  private onKeyUp(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') this.ctl.run?.setRewinding(false);
  }

  // ------------------------------------------------------------------ cards

  private showBrief() {
    const l = this.cfg.level;
    const inv = this.session.inventory().filter((r) => r.type !== 'wire');
    const body = [
      this.cfg.briefIntro?.() ?? null,
      h('p', { style: { margin: '0 0 6px', fontSize: '16px' } }, l.description || 'Make it happen.'),
      l.goals.length ? h('ul', { class: 'brief-goals' }, l.goals.map((g) => h('li', null, goalLabel(g, l)))) : null,
      h(
        'div',
        { class: 'brief-meta' },
        inv.length ? h('span', { class: 'pill' }, (() => { const n = inv.reduce((n, r) => n + (r.total < 0 ? 0 : r.total), 0); return n ? `${plural(n, 'part')} in the bin` : '∞ parts in the bin'; })()) : h('span', { class: 'pill' }, 'No parts: just watch'),
        l.restrictions?.timeLimit ? h('span', { class: 'pill' }, `${l.restrictions.timeLimit}s time limit`) : null,
        l.restrictions?.maxParts !== undefined && inv.length ? h('span', { class: 'pill' }, `at most ${plural(l.restrictions.maxParts, 'part')}`) : null,
        elegantGoal(l) ? h('span', { class: 'pill elegant' }, `ELEGANT: ${elegantGoal(l)}`) : null,
        l.bonus?.absurdStages === 0 ? null : h('span', { class: 'pill absurd' }, `ABSURD: ${l.bonus?.absurdStages ?? 7}+ stage chain`),
      ),
    ];
    const cur = this.cfg.difficulty;
    if (cur)
      body.push(
        h(
          'div',
          { class: 'brief-diff' },
          h('span', { class: 'muted' }, 'Difficulty'),
          difficultyBadge(cur, this.app),
          h('button', { class: 'linkish', type: 'button', onClick: () => (this.app.sfx('ui'), this.app.openSettings('difficulty')) }, 'change'),
        ),
      );
    modal(this.app.ui, {
      title: this.cfg.title,
      body,
      strip: 'hazard',
      actions: [{ label: 'Let’s build', kind: 'primary', icon: 'wrench', onClick: () => {} }],
      onClose: () => {
        if (this.dead) return;
        if (l.metadata?.tutorial && !this.guideShowing) this.nextHint(true);
        this.guide?.update();
      },
    });
  }

  private showControls() {
    const row = (k: string, d: string) => h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '3px 0' } }, h('span', null, d), h('span', { html: k }));
    modal(this.app.ui, {
      title: 'Controls',
      body: [
        h(
          'div',
          { style: { columns: '2', columnGap: '28px', fontSize: '14px' } },
          row('<kbd>Space</kbd>', 'Run / reset'),
          row('drag', 'Place or move a part'),
          row('<kbd>Q</kbd> <kbd>E</kbd>', 'Rotate (Shift: fine)'),
          row('<kbd>F</kbd>', 'Flip'),
          row('<kbd>Del</kbd>', 'Delete'),
          row('<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd>', 'Undo / redo'),
          row('<kbd>Ctrl</kbd>+<kbd>D</kbd>', 'Duplicate'),
          row('<kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>V</kbd>', 'Copy / paste'),
          row('arrows', 'Nudge (Shift: 10)'),
          row('<kbd>G</kbd>', 'Snap on/off'),
          row('<kbd>Alt</kbd> + drag', 'Move without snapping'),
          row('wheel', 'Zoom'),
          row('right-drag', 'Pan'),
          row('<kbd>0</kbd>', 'Fit view'),
          row('<kbd>P</kbd>', 'Pause'),
          row('<kbd>.</kbd> / <kbd>→</kbd>', 'Step one frame'),
          row('hold <kbd>←</kbd>', 'Rewind'),
          row('<kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>', 'Speed'),
          row('<kbd>H</kbd>', 'Hint'),
          row('<kbd>Esc</kbd>', 'Cancel / reset'),
        ),
        h('p', { class: 'muted', style: { fontSize: '13px', marginBottom: '0' } }, 'Ropes, belts and wires live in the parts bin: pick one, then click the two things to connect. Ropes can be routed over pulleys by clicking them on the way.'),
      ],
      actions: [{ label: 'Got it', kind: 'primary', onClick: () => {} }],
      width: 620,
    });
  }

  /** Time-up banner; `stalled` is the early version shown when everything stopped moving. */
  private showTimeUp(stalled = false) {
    this.timeUpEl?.remove();
    const el = h(
      'div',
      { class: 'panel banner' },
      h(
        'span',
        null,
        stalled ? h('b', null, 'Everything’s stopped. ') : h('b', null, 'Time’s up. '),
        (this.ctl.run && describeMiss(this.ctl.run.sim)) ?? (stalled ? 'The goal isn’t met.' : 'The machine didn’t finish the job (yet).'),
        stalled ? ' Rewind to see where it went wrong.' : '',
      ),
      h('button', { class: 'btn small', onClick: () => close(() => (stalled ? undefined : this.ctl.run?.extendTime())) }, 'Keep watching'),
      h('button', { class: 'btn small primary', onClick: () => close(() => this.ctl.reset()) }, icon('reset'), 'Back to building'),
    );
    const close = (fn: () => void) => {
      el.remove();
      this.timeUpEl = null;
      fn();
    };
    this.timeUpEl = el;
    this.root.append(el);
  }

  private showResults(raw: AttemptResult) {
    const r = applyHintPenalty(raw, this.hints.tierUsed);
    this.cfg.onSolved?.(r);
    this.ctl.run?.setPaused(true);
    const stamp = (cls: string, title: string, on: boolean, why: string) => h('div', { class: `stamp ${cls} ${on ? 'on' : ''}` }, h('b', null, title), h('small', null, why));
    // Stars: one for solving, one for ELEGANT, one for ABSURD (when the level offers it).
    const starsOn = [true, r.elegant.earned, ...(r.absurd.available ? [r.absurd.earned] : [])];
    const earned = starsOn.filter(Boolean).length;
    const hero = h(
      'div',
      { class: 'result-hero' },
      h(
        'div',
        { class: 'stars', role: 'img', 'aria-label': `${earned} of ${starsOn.length} stars` },
        starsOn.map((on, i) => h('span', { class: `star ${on ? 'on' : ''}`, style: { animationDelay: `${0.12 + i * 0.22}s` } }, '★')),
      ),
      h(
        'div',
        { class: 'result-line' },
        h('span', null, `Solved in ${r.time?.toFixed(1)}s with ${plural(r.parts, 'part')}`),
        this.cfg.difficulty ? difficultyBadge(this.cfg.difficulty) : null,
      ),
      r.hintTier ? h('span', { class: 'hint-note' }, `Solved with hints (up to ${hintTierLabel(r.hintTier)})`) : null,
    );
    const receipt = h(
      'div',
      { class: 'receipt' },
      h('div', { class: 'r-head' }, 'FOLLYWORKS · WORK ORDER'),
      receiptRows(r, this.ctl.run?.sim).map((c) => h('div', { class: `r-row${c.goal ? ' goal' : ''}` }, h('span', null, `${c.time.toFixed(1)}s`), h('span', null, c.label))),
      h('div', { class: 'r-total' }, h('span', null, `${plural(r.stages, 'stage')} · ${plural(r.domains.length, 'domain')}`), h('span', null, `${plural(r.parts, 'part')} · ${r.time?.toFixed(1)}s`)),
    );
    // The way forward comes first (and takes the focus); then replay, then back to building.
    const actions: { label: string; kind?: string; onClick: () => void | boolean; icon?: string }[] = [];
    if (this.cfg.kind === 'test') actions.push({ label: 'Back to editor', kind: 'primary', onClick: () => this.cfg.onReturn?.() });
    else if (this.cfg.onNext) actions.push({ label: this.cfg.nextLabel ?? 'Next puzzle', kind: 'primary', icon: 'play', onClick: () => this.cfg.onNext!() });
    else actions.push({ label: `Back to ${(this.cfg.exitLabel ?? 'Menu').toLowerCase()}`, kind: 'primary', icon: 'back', onClick: () => this.exit() });
    actions.push({
      label: 'Watch replay',
      icon: 'rewind',
      onClick: () => {
        const run = this.ctl.run;
        if (!run) return;
        run.scrubTo(0);
        run.endScrub();
        run.setPaused(false);
      },
    });
    actions.push({ label: 'Keep tinkering', onClick: () => this.ctl.reset() });
    this.app.sfx('success' as SfxName);
    this.resultModal = modal(this.app.ui, {
      title: pickTitle(r),
      strip: 'hazard',
      cls: 'results',
      body: [
        hero,
        h('div', { class: 'stamps' }, stamp('s', 'SOLVED', true, 'Job done!'), stamp('e', 'ELEGANT', r.elegant.earned, r.elegant.reason), r.absurd.available ? stamp('a', 'ABSURD', r.absurd.earned, r.absurd.reason) : null),
        receipt,
        physicsInMachine([...new Set([...(this.cfg.concepts ?? []), ...conceptsInRun(r.chain, (id) => this.ctl.run?.sim.entities.get(id)?.type, 6 - (this.cfg.concepts?.length ?? 0))])]),
      ],
      actions,
      width: 600,
      onClose: () => (this.resultModal = null),
    });
  }
}

/** The work order: every stage of the chain reaction, plus each goal ticked off, in time order. */
const receiptRows = (r: AttemptResult, sim: Simulation | undefined) => {
  const rows: { time: number; label: string; goal?: boolean }[] = r.chain.map((c) => ({ time: c.time, label: c.label }));
  if (sim) {
    sim.level.goals.forEach((g, i) => {
      const st = sim.goals.status[i];
      if (st?.met && st.metAt !== null) rows.push({ time: st.metAt, label: `✓ ${goalLabel(g, sim.level)}`, goal: true });
    });
  }
  return rows.sort((a, b) => a.time - b.time || (a.goal ? 1 : 0) - (b.goal ? 1 : 0));
};

/** "≤ 3 parts or under 4s": the briefing's one-line ELEGANT target, or '' when the level has none. */
const elegantGoal = (l: LevelDef) =>
  [l.bonus?.elegantParts !== undefined ? `≤ ${plural(l.bonus.elegantParts, 'part')}` : '', l.bonus?.elegantTime !== undefined ? `under ${l.bonus.elegantTime}s` : ''].filter(Boolean).join(' or ');

const pickTitle = (r: AttemptResult) => {
  if (r.absurd.earned && r.elegant.earned) return 'Magnificently pointless.';
  if (r.absurd.earned) return 'Gloriously unnecessary!';
  if (r.elegant.earned) return 'Clean. Almost suspiciously so.';
  const t = ['It worked!', 'Machine complete.', 'Contraption certified.', 'Against all odds.'];
  return t[(r.stages + r.parts) % t.length];
};

// paletteComponents is re-exported for EditorPanel convenience
export { paletteComponents };
