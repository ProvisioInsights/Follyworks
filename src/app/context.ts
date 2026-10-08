// What screens need from the application shell.

import type { AudioEngine } from '../audio/AudioEngine';
import type { CheatId } from '../game/cheats';
import type { Difficulty } from '../persistence/save';
import type { SaveStore, Settings } from '../persistence/save';
import type { WorkshopScene } from '../render/WorkshopScene';

export interface AppContext {
  store: SaveStore;
  audio: AudioEngine;
  scene: WorkshopScene;
  canvas: HTMLCanvasElement;
  /** Root element for screen DOM. */
  ui: HTMLElement;
  get settings(): Settings;
  updateSettings(patch: Partial<Settings>): void;
  /** Open Settings; 'difficulty' scrolls to and highlights the Difficulty control. */
  openSettings(focus?: 'difficulty'): void;
  /** Difficulty the open campaign mission was started on (null outside the campaign). */
  readonly missionDifficulty: Difficulty | null;
  /** Re-enter the open campaign mission, picking up the current difficulty setting. */
  restartMission(): void;
  showMenu(): void;
  showCampaign(): void;
  showLevels(): void;
  playCampaign(index: number): void;
  showLab(): void;
  playLab(index: number): void;
  playCustom(levelId: string): void;
  editLevel(levelId: string): void;
  openSandbox(slotId?: string): void;
  /** A cheat code was entered (keyboard or the hidden code box): toggle it, with a toast. */
  enterCheat(id: CheatId): void;
  /** Settings switch for a found cheat. */
  setCheat(id: CheatId, on: boolean): void;
  cheatOn(id: CheatId): boolean;
  allCheatsOff(): void;
  sfx(name: string, opts?: { vol?: number; pitch?: number }): void;
}
