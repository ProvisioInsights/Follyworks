// The campaign: the tutorial and the mission groups, collected in play order. Levels are pure data
// (see levels/*.ts).

import type { LevelProgress } from '../persistence/save';
import { GROUP_1 } from './levels/group1';
import { GROUP_2 } from './levels/group2';
import { GROUP_3 } from './levels/group3';
import { GROUP_4 } from './levels/group4';
import { GROUP_5 } from './levels/group5';
import { GROUP_6 } from './levels/group6';
import { TUTORIAL } from './levels/tutorial';
import { CHAPTERS, type CampaignEntry } from './levels/types';

export { CHAPTERS };
export type { CampaignEntry };

export const CAMPAIGN: CampaignEntry[] = [...TUTORIAL, ...GROUP_1, ...GROUP_2, ...GROUP_3, ...GROUP_4, ...GROUP_5, ...GROUP_6];

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
