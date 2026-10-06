// Physics Lab: every lesson mission is solvable with its reference build, unsolved when empty,
// forgiving to small nudges, and its counterexamples (the "wrong idea") fail. The lab is its own
// list, outside the ramped CAMPAIGN, and each lesson is tied to a science card.

import { describe, expect, it } from 'vitest';
import { CONCEPTS } from '../../src/content/science';
import { STANDARD_WORLD } from '../../src/core/level';
import { CAMPAIGN } from '../../src/game/campaign';
import { LAB, LAB_CHAPTER, labCode, labIndex } from '../../src/game/levels/lab';
import { describeEntryChecks } from './entryChecks';

describe('Physics Lab structure', () => {
  it('has 8 to 10 lessons with unique lab- ids, none of them in the campaign', () => {
    expect(LAB.length).toBeGreaterThanOrEqual(8);
    expect(LAB.length).toBeLessThanOrEqual(10);
    const ids = LAB.map((e) => e.level.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('lab-')).toBe(true);
    const campaignIds = new Set(CAMPAIGN.map((e) => e.level.id));
    for (const id of ids) expect(campaignIds.has(id)).toBe(false);
  });

  it('teaches a different concept in every lesson, each with a science card', () => {
    const concepts = LAB.map((e) => e.concept);
    expect(new Set(concepts).size).toBe(concepts.length);
    for (const c of concepts) expect(CONCEPTS[c], c).toBeTruthy();
  });

  it('codes and lookups line up', () => {
    LAB.forEach((e, i) => {
      expect(labIndex(e.level.id)).toBe(i);
      expect(labCode(i)).toBe(`L${i + 1}`);
    });
    expect(labCode(LAB.length)).toBe('');
  });

  for (const e of LAB)
    it(`${e.level.id}: metadata, intro and content are sane`, () => {
      expect(e.chapter).toBe(LAB_CHAPTER);
      expect(e.level.metadata?.chapter).toBe(LAB_CHAPTER);
      expect(e.level.metadata?.tutorial).toBeFalsy();
      expect(e.level.name.length).toBeGreaterThan(2);
      expect(e.level.description.length).toBeGreaterThan(20);
      for (const k of ['idea', 'picture', 'challenge'] as const) expect(e.intro[k].length, k).toBeGreaterThan(30);
      expect(e.level.hints?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(e.level.hints!.length).toBeLessThanOrEqual(3);
      expect(e.level.goals.length).toBeGreaterThan(0);
      expect(e.level.restrictions?.timeLimit).toBeGreaterThan(0);
      expect(e.level.bonus?.absurdStages, 'lessons have no ABSURD bonus').toBe(0);
      expect(e.solutions.length).toBeGreaterThan(0);
      expect(e.counterexamples?.length ?? 0, 'each lesson shows the wrong idea failing').toBeGreaterThan(0);
      expect(e.level.world.width).toBe(STANDARD_WORLD.width);
      expect(e.level.world.height).toBe(STANDARD_WORLD.height);
    });
});

for (const entry of LAB) describeEntryChecks(entry);
