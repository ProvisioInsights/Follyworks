// Visual and musical themes. A theme reskins the room, the parts, the HUD chrome and the music;
// it never changes physics. Missions get a theme from their group (eras advance as the parts get
// more advanced), and the player can override it in Settings.

export type ThemeId = 'retro' | 'stone' | 'steam' | 'modern' | 'comic' | 'future';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  blurb: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'retro', name: 'Retro Toolbox', blurb: 'Chunky 90s puzzle-box charm: flat colours, bold outlines, bevelled grey panels.' },
  { id: 'stone', name: 'Stone Age', blurb: 'Rock, log, bone and vine. Engineering, but with a club.' },
  { id: 'steam', name: 'Steam & Brass', blurb: 'Rivets, copper pipes, gauges and a great deal of unnecessary steam.' },
  { id: 'modern', name: 'Modern Workshop', blurb: 'The garage, the basement and the lab as you know them.' },
  { id: 'comic', name: 'Comic Heroics', blurb: 'Ink lines, halftone dots and machines that deserve a dramatic caption.' },
  { id: 'future', name: 'Far Future', blurb: 'Neon, glass and holograms. Still powered by a rubber ball, somehow.' },
];

/** Player override: 'auto' follows the mission's era. */
export type ThemeSetting = 'auto' | ThemeId;

/** Era by campaign chapter (0 tutorial, 1..5 mission groups, 6 lasers and light). */
export const CHAPTER_THEME: Record<number, ThemeId> = {
  0: 'retro',
  1: 'stone',
  2: 'steam',
  3: 'retro',
  4: 'modern',
  5: 'comic',
  6: 'future',
};

/** Theme for the Physics Lab learning track and anything without a chapter. */
export const DEFAULT_THEME: ThemeId = 'modern';

export const themeFor = (chapter: number | undefined, setting: ThemeSetting = 'auto'): ThemeId =>
  setting !== 'auto' ? setting : chapter === undefined ? DEFAULT_THEME : CHAPTER_THEME[chapter] ?? DEFAULT_THEME;
