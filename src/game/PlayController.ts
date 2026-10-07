// One play/edit session on screen: owns the Session (document + undo), the build-mode
// EditorController and, while running, a RunController. Switching BUILD <-> RUN never mutates
// the authored document; RESET returns to the exact pre-run state.

import type { AudioEngine } from '../audio/AudioEngine';
import type { BuildDef, LevelDef, Vec } from '../core/types';
import { Session, type SessionKind } from '../editor/Session';
import type { WorkshopScene } from '../render/WorkshopScene';
import type { OverlayState } from '../render/Overlays';
import type { Entity } from '../sim/Entity';
import { EditorController, type EditorFeedback } from './EditorController';
import { RunController } from './RunController';
import type { AttemptResult } from './scoring';

export type Mode = 'build' | 'run';

export interface PlayOptions {
  kind: SessionKind;
  level: LevelDef;
  build: BuildDef;
  audio: AudioEngine | null;
  feedback: EditorFeedback;
  showForces: () => boolean;
  ghostTrails: () => boolean;
  onSolved: (r: AttemptResult) => void;
  onTimeUp: () => void;
  onSettled?: () => void;
  onBuildChanged: (build: BuildDef, level: LevelDef) => void;
}

export class PlayController {
  readonly session: Session;
  readonly editor: EditorController;
  run: RunController | null = null;
  mode: Mode = 'build';
  private scene: WorkshopScene;
  private opts: PlayOptions;
  private listeners = new Set<() => void>();
  private unhook: (() => void)[] = [];
  private trails: Vec[][] = [];
  /** Number of runs this session (for attempts). */
  runs = 0;
  /** Goal the player is pointing at in the top bar: its zone and tag are highlighted. */
  focusGoal: number | null = null;

  constructor(scene: WorkshopScene, canvas: HTMLCanvasElement, opts: PlayOptions) {
    this.scene = scene;
    this.opts = opts;
    this.session = new Session(opts.kind, opts.level, opts.build);
    this.editor = new EditorController(scene, canvas, this.session, opts.feedback);
    this.unhook.push(this.editor.onChange(() => this.emit()));
    this.unhook.push(
      this.session.onChange(() => {
        this.opts.onBuildChanged(this.session.build, this.session.level);
      }),
    );
    this.unhook.push(scene.onFrame((dt) => this.frame(dt)));
    scene.resetView();
  }

  destroy() {
    this.run?.dispose();
    this.run = null;
    for (const u of this.unhook) u();
    this.editor.destroy();
    this.listeners.clear();
    this.scene.overlayState = null;
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn();
  }

  // ------------------------------------------------------------------ mode switching

  startRun() {
    if (this.mode === 'run') return;
    this.editor.cancel();
    this.editor.enabled = false;
    this.mode = 'run';
    this.runs++;
    this.opts.audio?.play('switch');
    this.run = new RunController(this.scene, this.session.level, this.session.build, this.opts.audio, {
      onSolved: (r) => this.opts.onSolved(r),
      onTimeUp: () => this.opts.onTimeUp(),
      onSettled: () => this.opts.onSettled?.(),
      onTick: () => this.emit(),
    });
    this.opts.audio?.setMusicIntensity(0.75);
    this.emit();
  }

  reset() {
    if (this.mode !== 'run') return;
    if (this.run) this.trails = this.run.trailLines();
    this.run?.dispose();
    this.run = null;
    this.mode = 'build';
    this.editor.enabled = true;
    this.scene.fx.clear();
    this.editor.rebuild();
    this.opts.audio?.play('rewind', { vol: 0.5 });
    this.opts.audio?.setMusicIntensity(0.3);
    this.emit();
  }

  toggleRun() {
    if (this.mode === 'build') this.startRun();
    else this.reset();
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number) {
    if (this.mode === 'run' && this.run) this.run.update(dt);
    const ed = this.editor;
    this.scene.overlayState = {
      mode: this.mode,
      alpha: this.scene.renderAlpha,
      selected: this.mode === 'build' ? ed.selected : new Set(),
      hover: this.mode === 'build' ? ed.hover : null,
      selectedConn: this.mode === 'build' ? ed.selectedConn : null,
      hoverConn: this.mode === 'build' ? ed.hoverConn : null,
      invalid: ed.invalid,
      tool: this.mode === 'build' ? ed.tool : null,
      pending: this.mode === 'build' ? ed.pending : null,
      toolHover: this.mode === 'build' ? ed.toolHover : null,
      showForces: this.opts.showForces(),
      trails: this.mode === 'build' && this.opts.ghostTrails() ? this.trails : [],
      offsetOf: (e) => this.scene.view(e.id)?.dragOffset ?? { x: 0, y: 0 },
      goalMet: this.run ? this.run.sim.goals.status.map((s) => s.met) : [],
      editor: this.session.editsLevel,
      selectedGoal: this.session.editsLevel ? ed.selectedGoal : null,
      guide: this.hintGhosts.length ? { ghosts: [...(this.guideOverlay?.ghosts ?? []), ...this.hintGhosts], point: this.guideOverlay?.point ?? null } : this.guideOverlay,
      handles: this.mode === 'build' ? ed.handles() : null,
      zoom: this.scene.zoom,
      manip: this.mode === 'build' ? ed.manip : null,
      hoverCorner: this.mode === 'build' ? ed.hoverCorner : null,
      focusGoal: this.focusGoal,
    };
  }

  /** Set by the HUD while tutorial guidance shows a ghost part or points into the room. */
  guideOverlay: OverlayState['guide'] = null;
  /** Ghost outlines revealed by tiered hints (game/hints.ts), drawn with the guide overlay. */
  hintGhosts: Entity[] = [];

  clearTrails() {
    this.trails = [];
  }
}
