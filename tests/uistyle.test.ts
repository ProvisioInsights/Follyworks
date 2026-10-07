import { describe, expect, it } from 'vitest';
import { CHAPTER_THEME, chromeFor, pickableThemes, THEMES } from '../src/core/themes';
import { DEFAULT_SETTINGS, parseSettings } from '../src/persistence/save';

describe('interface style', () => {
  it('defaults to the modern HUD for new and old saves', () => {
    expect(DEFAULT_SETTINGS.uiStyle).toBe('modern');
    expect(parseSettings({ theme: 'retro' }).uiStyle).toBe('modern');
    expect(parseSettings({ uiStyle: 'era' }).uiStyle).toBe('era');
    expect(parseSettings({ uiStyle: 'win31' }).uiStyle).toBe('modern');
  });

  it('modern chrome ignores the scene theme; classic follows it', () => {
    for (const t of THEMES.filter((x) => !x.secret)) {
      expect(chromeFor(t.id, 'modern')).toBeNull();
      expect(chromeFor(t.id, 'era')).toBe(t.id);
    }
  });

  it('the arcade theme always brings its cabinet chrome', () => {
    expect(chromeFor('arcade', 'modern')).toBe('arcade');
    expect(chromeFor('arcade', 'era')).toBe('arcade');
  });
});

describe('secret arcade theme', () => {
  it('is hidden from pickers and eras until unlocked', () => {
    expect(pickableThemes(false).some((t) => t.id === 'arcade')).toBe(false);
    expect(pickableThemes(true).some((t) => t.id === 'arcade')).toBe(true);
    expect(Object.values(CHAPTER_THEME)).not.toContain('arcade');
  });

  it('a save can only select it once it is unlocked', () => {
    expect(DEFAULT_SETTINGS.arcadeUnlocked).toBe(false);
    expect(parseSettings({ theme: 'arcade' }).theme).toBe('auto');
    const s = parseSettings({ theme: 'arcade', arcadeUnlocked: true });
    expect(s.theme).toBe('arcade');
    expect(s.arcadeUnlocked).toBe(true);
  });
});
