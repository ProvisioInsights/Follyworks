// Music / stinger themes. Mirrors ThemeId in src/core/themes.ts (kept as a local string union so
// the audio folder has no dependency on the visual theme module; any ThemeId string is accepted).

export type MusicTheme = 'retro' | 'stone' | 'steam' | 'modern' | 'comic' | 'future';

export const MUSIC_THEMES: readonly MusicTheme[] = ['retro', 'stone', 'steam', 'modern', 'comic', 'future'];

/** Unknown or missing ids fall back to 'modern' (the original workshop bed). */
export function normTheme(id: unknown): MusicTheme {
  return typeof id === 'string' && (MUSIC_THEMES as readonly string[]).includes(id) ? (id as MusicTheme) : 'modern';
}
