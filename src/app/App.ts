// Application shell: owns persistence, audio, the Phaser game and screen routing.

import Phaser from 'phaser';
import { AudioEngine, type SfxName } from '../audio/AudioEngine';
import { blankLevel, parseBuild } from '../core/level';
import { themeFor, type ThemeId, type ThemeSetting } from '../core/themes';
import { deepClone } from '../core/util';
import { emptyBuild, type BuildDef, type LevelDef } from '../core/types';
import { CAMPAIGN, CHAPTERS, levelCode } from '../game/campaign';
import { RunController } from '../game/RunController';
import { mergeProgress, type AttemptResult } from '../game/scoring';
import { SaveStore, type Settings } from '../persistence/save';
import { WorkshopScene } from '../render/WorkshopScene';
import { h, installTooltips, modal, toast } from '../ui/dom';
import { PlayScreen } from '../ui/PlayScreen';
import { campaignScreen, levelsScreen, mainMenu, settingsDialog, type Screen } from '../ui/screens';
import type { AppContext } from './context';

export class App implements AppContext {
  store = new SaveStore();
  audio = new AudioEngine();
  scene!: WorkshopScene;
  canvas!: HTMLCanvasElement;
  ui: HTMLElement;
  private game!: Phaser.Game;
  private screen: Screen | null = null;
  private play: PlayScreen | null = null;
  private demo: { run: RunController; unhook: () => void; doneAt: number } | null = null;
  /** Chapter whose era picks the theme on 'auto' (undefined: sandbox, editor, custom levels). */
  private themeChapter: number | undefined = undefined;
  /** Theme picked in the sandbox or editor for this visit only (overrides the setting there). */
  private sessionTheme: ThemeSetting = 'auto';
  private musicTheme: ThemeId | null = null;

  constructor() {
    this.ui = document.getElementById('ui')!;
  }

  get settings(): Settings {
    return this.store.data.settings;
  }

  async start() {
    installTooltips();
    const scene = new WorkshopScene();
    this.game = new Phaser.Game({
      type: new URLSearchParams(location.search).get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
      parent: 'stage',
      backgroundColor: '#0d0a08',
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: [scene],
      banner: false,
      fps: { target: 60 },
      render: { antialias: true, roundPixels: false, ...renderOverrides() },
      input: { keyboard: false, mouse: { preventDefaultWheel: false } },
    } as Phaser.Types.Core.GameConfig);
    await scene.readyPromise;
    this.scene = scene;
    this.canvas = this.game.canvas;
    this.canvas.tabIndex = 0;
    this.applySettings();
    // audio needs a user gesture
    const unlock = () => {
      this.audio.unlock();
      this.audio.startMusic();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('beforeunload', () => this.store.flush());
    document.addEventListener('visibilitychange', () => document.hidden && this.store.flush());
    if (this.store.recovered) toast('Your save data was damaged, so we started fresh. A backup of the old data was kept.', 'warn', 6000);
    (window as any).__follyworks = this; // handy for debugging and automated tests
    this.showMenu();
    document.getElementById('boot')?.remove();
  }

  /** Debug/test hook: load the k-th verified solution of the open campaign level (negative counts from the end). */
  debugLoadSolution(k = 0) {
    const play = this.play;
    if (!play) return false;
    const entry = CAMPAIGN.find((c) => c.level.id === play.ctl.session.level.id);
    const sol = entry?.solutions[k < 0 ? entry.solutions.length + k : k];
    if (!sol) return false;
    play.ctl.session.replace(play.ctl.session.level, deepClone(sol));
    return true;
  }

  // ------------------------------------------------------------------ settings

  updateSettings(patch: Partial<Settings>) {
    Object.assign(this.store.data.settings, patch);
    this.store.save();
    this.applySettings();
  }

  private applySettings() {
    const s = this.settings;
    this.audio.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
    this.audio.setMuted(s.muted);
    document.documentElement.style.setProperty('--ts', String(s.textScale));
    document.body.classList.toggle('reduced', s.reducedMotion);
    if (this.scene) {
      this.scene.fx.reducedMotion = s.reducedMotion;
      this.scene.env.reducedMotion = s.reducedMotion;
    }
    if (this.play) this.play.ctl.editor.snap = s.snap;
    this.refreshTheme();
  }

  // ------------------------------------------------------------------ themes

  /** The theme in force right now: session pick, else the setting, else the era of the chapter. */
  get theme(): ThemeId {
    return themeFor(this.themeChapter, this.sessionTheme !== 'auto' ? this.sessionTheme : this.settings.theme);
  }

  /** Called on a screen change, before the new screen sets its sim and room. */
  private setThemeContext(chapter: number | undefined, session: ThemeSetting = 'auto') {
    this.themeChapter = chapter;
    this.sessionTheme = session;
    this.refreshTheme(true);
  }

  /** Sandbox / editor theme picker: applies to this visit only. */
  setSessionTheme(t: ThemeSetting) {
    this.sessionTheme = t;
    this.refreshTheme();
  }

  private refreshTheme(deferred = false) {
    const id = this.theme;
    document.documentElement.dataset.theme = id;
    if (this.scene && this.scene.currentTheme !== id) {
      this.scene.setTheme(id, deferred);
      this.play?.refreshTheme();
    }
    if (this.musicTheme !== id) {
      this.musicTheme = id;
      // Provided by the audio engine when themed music is available.
      (this.audio as any).setMusicTheme?.(id);
    }
  }

  openSettings() {
    settingsDialog(this);
  }

  sfx(name: string, opts?: { vol?: number; pitch?: number }) {
    this.audio.play(name as SfxName, opts);
  }

  // ------------------------------------------------------------------ routing

  private teardown() {
    this.screen?.destroy();
    this.screen = null;
    this.play?.destroy();
    this.play = null;
    this.stopDemo();
    for (const m of Array.from(this.ui.querySelectorAll('.modal-back'))) m.remove();
  }

  showMenu() {
    this.teardown();
    this.setThemeContext(this.demoChapter());
    this.startDemo();
    this.screen = mainMenu(this);
    this.audio.setMusicIntensity(0.2);
  }

  showCampaign() {
    this.teardown();
    this.setThemeContext(this.demoChapter());
    this.startDemo();
    this.screen = campaignScreen(this);
  }

  showLevels() {
    this.teardown();
    this.setThemeContext(this.demoChapter());
    this.startDemo();
    this.screen = levelsScreen(this, () => this.showLevels());
  }

  /** For automated tests (e2e/campaign.mjs). */
  get campaignLength() {
    return CAMPAIGN.length;
  }

  playCampaign(index: number) {
    const entry = CAMPAIGN[index];
    if (!entry) return this.showCampaign();
    this.teardown();
    this.setThemeContext(entry.chapter);
    const level = entry.level;
    const build = this.store.getBuild(level) ?? emptyBuild();
    const chapter = CHAPTERS.find((c) => c.index === entry.chapter);
    const progress = this.store.progress(level.id);
    this.play = new PlayScreen(this, {
      kind: 'campaign',
      level,
      build,
      title: level.name,
      subtitle: `${levelCode(index)} · ${chapter?.title ?? ''}${progress.solved ? ' · solved' : ''}`,
      brief: true,
      onExit: () => this.showCampaign(),
      exitLabel: 'Puzzles',
      onNext: index + 1 < CAMPAIGN.length ? () => this.playCampaign(index + 1) : undefined,
      onSolved: (r) => this.record(level.id, r),
      onBuildChanged: (b) => this.store.setBuild(level.id, b),
    });
  }

  playCustom(levelId: string) {
    const level = this.store.data.customLevels.find((l) => l.id === levelId);
    if (!level) return this.showLevels();
    this.teardown();
    this.setThemeContext(undefined);
    this.play = new PlayScreen(this, {
      kind: 'custom',
      level,
      build: this.store.getBuild(level) ?? emptyBuild(),
      title: level.name,
      subtitle: `Custom level${level.metadata?.author ? ` by ${level.metadata.author}` : ''}`,
      brief: true,
      onExit: () => this.showLevels(),
      exitLabel: 'Levels',
      onSolved: (r) => this.record(level.id, r),
      onBuildChanged: (b) => this.store.setBuild(level.id, b),
    });
  }

  editLevel(levelId: string, restore?: { level: LevelDef }) {
    const stored = this.store.data.customLevels.find((l) => l.id === levelId);
    if (!stored) return this.showLevels();
    const keep = this.sessionTheme;
    this.teardown();
    this.setThemeContext(undefined, restore ? keep : 'auto');
    const level = restore?.level ?? stored;
    this.store.data.editorLevelId = levelId;
    this.play = new PlayScreen(this, {
      kind: 'editor',
      level,
      build: emptyBuild(),
      title: level.name,
      subtitle: 'Level editor',
      onExit: () => this.showLevels(),
      exitLabel: 'Levels',
      onBuildChanged: (_b, l) => {
        l.metadata = { ...(l.metadata ?? {}), updated: new Date().toISOString() };
        this.store.upsertCustomLevel(deepClone(l));
      },
      onTest: (l) => this.testLevel(levelId, deepClone(l)),
      theme: { value: () => this.sessionTheme, set: (t) => this.setSessionTheme(t) },
    });
  }

  private testLevel(levelId: string, level: LevelDef) {
    if (!level.goals.length) {
      toast('Add at least one goal first (Goals tab), so the test knows what success looks like.', 'warn', 4000);
    }
    this.teardown();
    this.play = new PlayScreen(this, {
      kind: 'test',
      level,
      build: emptyBuild(),
      title: `Testing: ${level.name}`,
      subtitle: 'Play it like a player would · Esc / Back returns to the editor',
      onExit: () => this.editLevel(levelId, { level }),
      onReturn: () => this.editLevel(levelId, { level }),
      exitLabel: 'Editor',
    });
  }

  openSandbox(slotId?: string) {
    const keep = this.play?.cfgKind === 'sandbox' ? this.sessionTheme : 'auto';
    this.teardown();
    this.setThemeContext(undefined, keep);
    const slot = slotId ? this.store.data.sandboxSlots.find((s) => s.id === slotId) : null;
    const auto = this.store.data.sandboxSlots.find((s) => s.id === 'autosave');
    const src = slot ?? auto;
    const level = blankLevel('sandbox', 'Sandbox');
    level.environment = src?.environment ?? 'garage';
    level.restrictions = {};
    level.description = 'Every part, no goals, no rules.';
    const build: BuildDef = src ? parseBuildSafe(src.build, level) : emptyBuild();
    this.play = new PlayScreen(this, {
      kind: 'sandbox',
      level,
      build,
      title: slot?.name ?? 'Sandbox',
      subtitle: 'Every part, no rules',
      onExit: () => this.showMenu(),
      onBuildChanged: (b) => this.saveSlot('autosave', 'Autosave', b, level.environment),
      sandbox: {
        onSave: (name, b, env) => {
          const id = `slot-${Date.now().toString(36)}`;
          this.saveSlot(id, name, b, env);
        },
        onLoad: () => this.sandboxLoad(),
        onEnv: (env) => {
          const cur = this.play?.ctl.session.build ?? build;
          this.saveSlot('autosave', 'Autosave', cur, env);
          this.openSandbox();
        },
      },
      theme: { value: () => this.sessionTheme, set: (t) => this.setSessionTheme(t) },
    });
  }

  private saveSlot(id: string, name: string, build: BuildDef, environment: string) {
    const slots = this.store.data.sandboxSlots;
    const i = slots.findIndex((s) => s.id === id);
    const slot = { id, name, environment, build: deepClone(build), updated: new Date().toISOString() };
    if (i >= 0) slots[i] = slot;
    else slots.unshift(slot);
    this.store.save();
  }

  private sandboxLoad() {
    const slots = this.store.data.sandboxSlots.filter((s) => s.id !== 'autosave');
    const list = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
      slots.length
        ? slots.map((s) =>
            h(
              'div',
              { class: 'field-row', style: { alignItems: 'center' } },
              h('span', { style: { flex: '1' } }, h('b', null, s.name), h('div', { class: 'muted', style: { fontSize: '12px' } }, `${s.build.objects.length} parts · ${new Date(s.updated).toLocaleString()}`)),
              h('button', { class: 'btn small primary', style: { flex: 'none' }, onClick: () => (m.close(), this.openSandbox(s.id)) }, 'Load'),
              h(
                'button',
                {
                  class: 'btn small ghost',
                  style: { flex: 'none' },
                  onClick: () => {
                    this.store.data.sandboxSlots = this.store.data.sandboxSlots.filter((q) => q.id !== s.id);
                    this.store.save();
                    m.close();
                    this.sandboxLoad();
                  },
                },
                'Delete',
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'Nothing saved yet. Use Save in the sandbox to keep a contraption.'),
    );
    const m = modal(this.ui, {
      title: 'Saved contraptions',
      body: [list],
      actions: [
        { label: 'Clear sandbox', onClick: () => (this.saveSlot('autosave', 'Autosave', emptyBuild(), 'garage'), this.openSandbox()) },
        { label: 'Close', kind: 'primary', onClick: () => {} },
      ],
    });
  }

  private record(levelId: string, r: AttemptResult) {
    const prev = this.store.progress(levelId);
    const next = mergeProgress(prev, r);
    this.store.setProgress(levelId, next);
    this.store.flush();
  }

  // ------------------------------------------------------------------ attract mode

  private demoPick() {
    return (
      [...CAMPAIGN].reverse().find((c) => c.chapter === CHAPTERS[CHAPTERS.length - 1].index && c.solutions.length) ??
      [...CAMPAIGN].reverse().find((c) => c.solutions.length) ??
      null
    );
  }

  private demoChapter() {
    return this.demoPick()?.chapter;
  }

  private startDemo() {
    if (this.demo) return;
    const pick = this.demoPick();
    if (!pick) return;
    const level = deepClone(pick.level);
    const build = deepClone(pick.solutions[0]);
    this.scene.setEnvironment(level.environment, level.world.width, level.world.height);
    this.scene.setInsets({ top: 30, left: Math.min(520, window.innerWidth * 0.36), right: 30, bottom: 30 });
    this.scene.resetView();
    const make = () =>
      new RunController(this.scene, level, build, null, {
        onSolved: () => {},
        onTimeUp: () => {},
        onTick: () => {},
      });
    const state = { run: make(), unhook: () => {}, doneAt: 0 };
    state.unhook = this.scene.onFrame((dt) => {
      state.run.update(dt * 0.85);
      const s = state.run.sim;
      this.scene.overlayState = {
        mode: 'run',
        alpha: this.scene.renderAlpha,
        selected: new Set(),
        hover: null,
        selectedConn: null,
        hoverConn: null,
        invalid: new Set(),
        tool: null,
        pending: null,
        toolHover: null,
        showForces: false,
        trails: [],
        offsetOf: () => ({ x: 0, y: 0 }),
        goalMet: s.goals.status.map((q) => q.met),
        editor: false,
        selectedGoal: null,
      };
      if ((s.goals.solved || s.time > state.run.timeLimit) && !state.doneAt) state.doneAt = performance.now();
      if (state.doneAt && performance.now() - state.doneAt > 3500) {
        state.run.dispose();
        this.scene.fx.clear();
        state.run = make();
        state.doneAt = 0;
      }
    });
    this.demo = state;
  }

  private stopDemo() {
    if (!this.demo) return;
    this.demo.unhook();
    this.demo.run.dispose();
    this.scene.fx.clear();
    this.scene.overlayState = null;
    this.demo = null;
  }
}

const parseBuildSafe = (b: BuildDef, level: LevelDef): BuildDef => {
  try {
    return parseBuild(b, level);
  } catch {
    return emptyBuild();
  }
};

/** Debug knobs for chasing driver-specific rendering issues: ?maxtex=N, ?renderer=canvas. */
function renderOverrides(): Record<string, unknown> {
  const q = new URLSearchParams(location.search);
  // One texture per batch. Phaser 4's multi-texture batching drew some sprites as torn
  // half-quads (a plank rendered as a thin wedge) once 4+ textures shared a batch on SwiftShader;
  // our sprite counts are small, so the extra draw calls cost nothing measurable.
  const o: Record<string, unknown> = { maxTextures: 1 };
  if (q.get('maxtex')) o.maxTextures = Number(q.get('maxtex'));
  return o;
}
