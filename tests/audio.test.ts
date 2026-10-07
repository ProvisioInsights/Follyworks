// Pure-logic checks for the procedural audio (no Web Audio in Node: the engine must be inert).
import { describe, expect, it } from 'vitest';
import { AudioEngine, SFX_NAMES, LOOP_NAMES } from '../src/audio/AudioEngine';
import { chordTones } from '../src/audio/music';
import { STYLES } from '../src/audio/styles';
import { MUSIC_THEMES, normTheme } from '../src/audio/themes';
import { THEMES } from '../src/core/themes';

describe('music themes', () => {
  it('normalises theme ids, falling back to modern', () => {
    for (const t of MUSIC_THEMES) expect(normTheme(t)).toBe(t);
    expect(normTheme('nope')).toBe('modern');
    expect(normTheme(undefined)).toBe('modern');
    expect(normTheme(42)).toBe('modern');
  });

  it('has a well-formed style for every theme', () => {
    for (const t of MUSIC_THEMES) {
      const s = STYLES[t];
      expect(s.id).toBe(t);
      expect(s.bpm[0]).toBeLessThanOrEqual(s.bpm[1]);
      expect(s.level).toBeGreaterThan(0);
      for (const r of [...s.rhythms, ...(s.rhythmsB ?? [])]) {
        expect(r.length).toBe(s.beats * 4 * 2);
        expect(r).toMatch(/^[x.]+$/);
        expect(r).toContain('x');
      }
      for (const p of [...s.progA, ...s.progB]) {
        expect(p.length).toBeGreaterThan(0);
        for (const d of p) expect(d >= 0 && d <= 10).toBe(true);
      }
      expect(s.melody.length).toBeGreaterThanOrEqual(5);
      expect(s.melody.every((x) => x >= 0 && x < 12)).toBe(true);
    }
  });

  it('has a music theme for every visual theme, including the secret arcade one', () => {
    for (const t of THEMES) expect(normTheme(t.id)).toBe(t.id);
    expect(MUSIC_THEMES).toContain('arcade');
  });

  it('gives the arcade theme an upbeat chiptune in a major / mixolydian flavour', () => {
    const s = STYLES.arcade;
    expect(s.bpm[0]).toBeGreaterThanOrEqual(140);
    expect(s.bpm[1]).toBeLessThanOrEqual(150);
    expect(s.mode).toBe('major');
    expect(s.melody).toContain(10); // the flat seventh
    expect([...s.progA, ...s.progB].flat()).toContain(7); // bVII chords
    // calibrated like the others (offline-render loudness), not left at a default
    expect(s.level).toBeGreaterThan(0.4);
    expect(s.level).toBeLessThan(1.5);
  });

  it('builds chords from scale degrees and borrowed chords', () => {
    expect(chordTones(0, 'major', false)).toEqual([0, 4, 7]);
    expect(chordTones(0, 'major', true)).toEqual([0, 4, 7, 11]);
    expect(chordTones(5, 'major', false)).toEqual([9, 12, 16]);
    expect(chordTones(0, 'minor', false)).toEqual([0, 3, 7]);
    expect(chordTones(7, 'major', false)).toEqual([10, 14, 17]);
  });
});

describe('audio engine without Web Audio', () => {
  it('is inert and never throws', () => {
    const a = new AudioEngine();
    expect(() => {
      a.unlock();
      a.setMusicTheme('stone');
      a.setMusicTheme('not-a-theme');
      a.setMusicTheme('arcade');
      a.setMusicTheme('future');
      a.startMusic();
      a.setMusicIntensity(0.75);
      for (const n of SFX_NAMES) a.play(n);
      a.play('laserHum' as never);
      a.play('somethingNew' as never);
      a.impact('wood', 'wood', 10, 0, 'domino', 'domino');
      a.impact('metal', 'stone', 25, 0.5, 'heavy', 'floor');
      for (const n of LOOP_NAMES) a.setLoop('l-' + n, n, 0.8);
      a.setLoop('x', 'unknownLoop' as never, 1);
      a.stopAllLoops();
      a.stopMusic();
    }).not.toThrow();
    expect(a.musicTheme).toBe('future');
  });

  it('exposes the secret-unlock jingle', () => {
    expect(SFX_NAMES).toContain('secret');
    const a = new AudioEngine();
    expect(() => a.play('secret')).not.toThrow();
  });

  it('exposes the optics sounds', () => {
    expect(SFX_NAMES).toEqual(expect.arrayContaining(['laserOn', 'beamHit', 'sensorOn']));
    expect(LOOP_NAMES).toContain('laserHum');
  });
});
