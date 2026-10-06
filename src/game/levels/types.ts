// Campaign content contract. Each chapter file exports CampaignEntry[]; campaign.ts collects them.
// `solutions` are verification fixtures for tests only — the game never shows or requires them.

import type { BuildDef, LevelDef } from '../../core/types';

export interface CampaignEntry {
  /** 0 = tutorial, 1..10 = chapters. */
  chapter: number;
  level: LevelDef;
  /** One or more known-good builds (validated headlessly in tests/levels). */
  solutions: BuildDef[];
}

export interface ChapterInfo {
  index: number;
  title: string;
  subtitle: string;
}

export const CHAPTERS: ChapterInfo[] = [
  { index: 0, title: 'Orientation', subtitle: 'Welcome to the workshop' },
  { index: 1, title: 'Cause & Effect', subtitle: 'Things fall. Things hit things.' },
  { index: 2, title: 'Gravity', subtitle: 'Heavy, light and everything in between' },
  { index: 3, title: 'Momentum', subtitle: 'Launch, rebound, regret' },
  { index: 4, title: 'Springs & Levers', subtitle: 'Small push, big shove' },
  { index: 5, title: 'Ropes & Pulleys', subtitle: 'Pulling strings' },
  { index: 6, title: 'Mechanical Power', subtitle: 'Gears, belts and motors' },
  { index: 7, title: 'Air, Heat & Energy', subtitle: 'Hot air rises. So do balloons.' },
  { index: 8, title: 'Electricity', subtitle: 'Mind the wires' },
  { index: 9, title: 'Sensors & Logic', subtitle: 'If this, then that, then chaos' },
  { index: 10, title: 'Ridiculous Machines', subtitle: 'Build the unnecessary' },
];
