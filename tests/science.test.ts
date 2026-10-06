// "How it works" cards: every card is short and complete, every player-facing part has one, the
// results-card concept picker reads chain stages sensibly, and the lab's save field is migration-safe.

import { describe, expect, it } from 'vitest';
import '../src/components';
import { allComponents } from '../src/components';
import { conceptForStage, conceptsInRun, stageSubject } from '../src/content/runConcepts';
import { CONCEPTS, PART_CONCEPTS, conceptsForType, getConcept } from '../src/content/science';
import { defaultSave, parseLabSave, parseSave } from '../src/persistence/save';
import type { ChainEntry } from '../src/sim/Simulation';

const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z“"(])/).filter((s) => s.trim().length > 0);

describe('science cards', () => {
  for (const c of Object.values(CONCEPTS))
    it(`${c.id}: title, 2-4 sentences, a try-this line`, () => {
      expect(c.title.length).toBeGreaterThan(3);
      const n = c.body.flatMap(sentences).length;
      expect(n, c.body.join(' ')).toBeGreaterThanOrEqual(2);
      expect(n, c.body.join(' ')).toBeLessThanOrEqual(4);
      expect(c.tryIt.length).toBeGreaterThan(15);
      for (const t of [...c.body, c.tryIt, c.formula ?? '', c.realWorld ?? '', c.inGame ?? '']) {
        expect(t).not.toMatch(/\bTODO\b/);
        expect(t.trim()).toBe(t);
      }
    });

  it('ids match their keys and every mapped concept exists', () => {
    for (const [k, c] of Object.entries(CONCEPTS)) expect(c.id).toBe(k);
    for (const [type, ids] of Object.entries(PART_CONCEPTS)) {
      expect(ids.length, type).toBeGreaterThan(0);
      for (const id of ids) expect(CONCEPTS[id], `${type} -> ${id}`).toBeTruthy();
    }
  });

  it('every part in the parts bin has at least one card', () => {
    const missing = allComponents()
      .filter((d) => !d.internal && !d.sceneryOnly && d.category !== 'scenery')
      .map((d) => d.type)
      .filter((t) => conceptsForType(t).length === 0);
    expect(missing).toEqual([]);
  });

  it('unknown types and ids are harmless', () => {
    expect(conceptsForType('no_such_part')).toEqual([]);
    expect(getConcept('no_such_concept')).toBeUndefined();
    expect(getConcept('gravity')?.id).toBe('gravity');
  });
});

describe('concepts used by a run', () => {
  const types: Record<string, string> = {
    b1: 'ball',
    d1: 'domino',
    d2: 'domino',
    f1: 'fan',
    m1: 'magnet',
    bb: 'bowling_ball',
    dy: 'dynamite',
    bulb: 'light_bulb',
  };
  const typeOf = (id: string) => types[id];
  const stage = (key: string, label: string, time = 0): ChainEntry => ({ key, label, domain: 'gravity', time });

  it('reads the entity behind every kind of stage key', () => {
    expect(stageSubject('b1')).toEqual({ id: 'b1', rope: false });
    expect(stageSubject('m1>bb')).toEqual({ id: 'm1', rope: false });
    expect(stageSubject('dy:boom')).toEqual({ id: 'dy', rope: false });
    expect(stageSubject('rope:r1')).toEqual({ id: 'r1', rope: true });
  });

  it('maps stages to the concept they show', () => {
    expect(conceptForStage(stage('b1', 'Ball hit the domino'), typeOf)).toBe('momentum');
    expect(conceptForStage(stage('rope:r1', 'Rope burned through'), typeOf)).toBe('heat');
    expect(conceptForStage(stage('m1>bb', 'Magnet grabbed the bowling ball'), typeOf)).toBe('electromagnet');
    expect(conceptForStage(stage('f1', 'Fan on'), typeOf)).toBe('air');
    expect(conceptForStage(stage('bulb', 'Bulb lit'), typeOf)).toBe('circuit');
    expect(conceptForStage(stage('ghost', 'Something'), typeOf)).toBeNull();
  });

  it('lists unique concepts in order, and adds the chain card for long runs', () => {
    expect(conceptsInRun([], typeOf)).toEqual([]);
    expect(conceptsInRun([stage('f1', 'Fan on'), stage('f1', 'Fan on')], typeOf)).toEqual(['air']);
    const long = [stage('f1', 'Fan on'), stage('m1>bb', 'Magnet grabbed it'), stage('bulb', 'Bulb lit'), stage('d1', 'Domino fell')];
    const got = conceptsInRun(long, typeOf);
    expect(got).toEqual(['air', 'electromagnet', 'circuit', 'chain']);
    expect(new Set(got).size).toBe(got.length);
  });

  it('caps the list and keeps the chain card last', () => {
    const many = [
      stage('f1', 'Fan on'),
      stage('m1>bb', 'Magnet grabbed it'),
      stage('bulb', 'Bulb lit'),
      stage('b1', 'Ball hit the crate'),
      stage('rope:r', 'Rope burned'),
      stage('dy', 'Fuse lit'),
      stage('d1', 'Domino fell'),
    ];
    const got = conceptsInRun(many, typeOf, 4);
    expect(got.length).toBe(4);
    expect(got[got.length - 1]).toBe('chain');
  });
});

describe('lab save field', () => {
  it('old saves without a lab record load with a fresh one', () => {
    const old = { version: 2, settings: {}, progress: { 'lab-heavyweight': { solved: true } } };
    const { data, recovered } = parseSave(JSON.stringify(old));
    expect(recovered).toBe(false);
    expect(data.lab).toEqual({ lastPlayed: null });
    expect(data.progress['lab-heavyweight'].solved).toBe(true);
  });

  it('garbage in the lab record is ignored', () => {
    for (const raw of [null, 3, 'x', [], { lastPlayed: 5 }]) expect(parseLabSave(raw)).toEqual({ lastPlayed: null });
    expect(parseLabSave({ lastPlayed: 'lab-lift-off' })).toEqual({ lastPlayed: 'lab-lift-off' });
  });

  it('round-trips', () => {
    const d = defaultSave();
    d.lab.lastPlayed = 'lab-two-key-lock';
    expect(parseSave(JSON.stringify(d)).data.lab.lastPlayed).toBe('lab-two-key-lock');
  });
});
