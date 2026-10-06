// The campaign: chapter files collected in order. Levels are pure data (see levels/*.ts).

import type { LevelProgress } from '../persistence/save';
import { CHAPTER_0 } from './levels/ch00_tutorial';
import { CHAPTER_1 } from './levels/ch01';
import { CHAPTER_2 } from './levels/ch02';
import { CHAPTER_3 } from './levels/ch03';
import { CHAPTER_4 } from './levels/ch04';
import { CHAPTER_5 } from './levels/ch05';
import { CHAPTER_6 } from './levels/ch06';
import { CHAPTER_7 } from './levels/ch07';
import { CHAPTER_8 } from './levels/ch08';
import { CHAPTER_9 } from './levels/ch09';
import { CHAPTER_10 } from './levels/ch10';
import { CHAPTERS, type CampaignEntry } from './levels/types';

export { CHAPTERS };
export type { CampaignEntry };

export const CAMPAIGN: CampaignEntry[] = [
  ...CHAPTER_0,
  ...CHAPTER_1,
  ...CHAPTER_2,
  ...CHAPTER_3,
  ...CHAPTER_4,
  ...CHAPTER_5,
  ...CHAPTER_6,
  ...CHAPTER_7,
  ...CHAPTER_8,
  ...CHAPTER_9,
  ...CHAPTER_10,
];

export const campaignIndex = (id: string) => CAMPAIGN.findIndex((c) => c.level.id === id);

export const solvedCount = (progress: Record<string, LevelProgress>) => CAMPAIGN.filter((c) => progress[c.level.id]?.solved).length;

/** A level is open when it is within three of the number you have solved, so one stuck puzzle never blocks you. */
export const isUnlocked = (index: number, progress: Record<string, LevelProgress>, unlockAll: boolean) =>
  unlockAll || index < solvedCount(progress) + 3 || !!progress[CAMPAIGN[index]?.level.id]?.solved;

/** Display label such as "3-2" or "T4". */
export const levelCode = (index: number) => {
  const e = CAMPAIGN[index];
  if (!e) return '';
  const inChapter = CAMPAIGN.filter((c, i) => c.chapter === e.chapter && i <= index).length;
  return e.chapter === 0 ? `T${inChapter}` : `${e.chapter}-${inChapter}`;
};
