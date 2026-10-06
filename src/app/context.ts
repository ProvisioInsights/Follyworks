// What screens need from the application shell.

import type { AudioEngine } from '../audio/AudioEngine';
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
  openSettings(): void;
  showMenu(): void;
  showCampaign(): void;
  showLevels(): void;
  playCampaign(index: number): void;
  showLab(): void;
  playLab(index: number): void;
  playCustom(levelId: string): void;
  editLevel(levelId: string): void;
  openSandbox(slotId?: string): void;
  sfx(name: string, opts?: { vol?: number; pitch?: number }): void;
}
