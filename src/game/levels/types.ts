// Campaign content contract. Each group file exports CampaignEntry[]; campaign.ts collects them.
// `solutions` and `counterexamples` are verification fixtures for tests only. The game never shows
// or requires them.

import type { BuildDef, LevelDef } from '../../core/types';

export interface CampaignEntry {
  /** 0 = tutorial, 1.. = mission groups (see CHAPTERS). */
  chapter: number;
  level: LevelDef;
  /**
   * Known-good builds, validated headlessly in tests/levels. solutions[0] is the simplest
   * reference build: its part count is what "parts needed" means in the difficulty ramp, and it
   * must not earn ABSURD. At least one solution must earn ABSURD when the level offers it.
   */
  solutions: BuildDef[];
  /** Tempting builds that must NOT solve the level (keeps the intended idea load-bearing). */
  counterexamples?: { why: string; build: BuildDef }[];
}

export interface ChapterInfo {
  index: number;
  title: string;
  subtitle: string;
}

/** Mission groups in play order. Adding a group means adding a file in levels/ and a row here. */
export const CHAPTERS: ChapterInfo[] = [
  { index: 0, title: 'Orientation', subtitle: 'Welcome to the workshop' },
  { index: 1, title: 'Workshop Basics', subtitle: 'Things fall. Things hit things.' },
  { index: 2, title: 'Levers & Lines', subtitle: 'Seesaws, springs, ropes and pulleys' },
  { index: 3, title: 'Moving Parts', subtitle: 'Motors, gears, belts, conveyors and Bolt' },
  { index: 4, title: 'Hot Air & Sparks', subtitle: 'Fans, balloons, fire, batteries and magnets' },
  { index: 5, title: 'Ridiculous Machines', subtitle: 'Sensors, logic, explosives and glorious overkill' },
];
