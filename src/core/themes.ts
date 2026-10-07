// Visual and musical themes. A theme reskins the room, the parts, the HUD chrome and the music;
// it never changes physics. Missions get a theme from their group (eras advance as the parts get
// more advanced), and the player can override it in Settings.

export type ThemeId = 'retro' | 'stone' | 'steam' | 'modern' | 'comic' | 'future' | 'arcade';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Hidden until unlocked (the arcade theme is a Konami-code easter egg). */
  secret?: boolean;
}

export const THEMES: ThemeInfo[] = [
  { id: 'retro', name: 'Retro Toolbox', blurb: 'Chunky 90s puzzle-box charm: flat colours, bold outlines, bevelled grey panels.' },
  { id: 'stone', name: 'Stone Age', blurb: 'Rock, log, bone and vine. Engineering, but with a club.' },
  { id: 'steam', name: 'Steam & Brass', blurb: 'Rivets, copper pipes, gauges and a great deal of unnecessary steam.' },
  { id: 'modern', name: 'Modern Workshop', blurb: 'The garage, the basement and the lab as you know them.' },
  { id: 'comic', name: 'Comic Heroics', blurb: 'Ink lines, halftone dots and machines that deserve a dramatic caption.' },
  { id: 'future', name: 'Far Future', blurb: 'Neon, glass and holograms. Still powered by a rubber ball, somehow.' },
  {
    id: 'arcade',
    name: 'Insert Coin',
    blurb: 'Secret! Chunky pixels, scanlines and chiptunes from the cartridge era. Enter the code again to switch it off.',
    secret: true,
  },
];

/** Themes the player may pick: secret ones only once unlocked. */
export const pickableThemes = (arcadeUnlocked: boolean): ThemeInfo[] => THEMES.filter((t) => !t.secret || arcadeUnlocked);

/**
 * Interface style. 'modern' is one clean, theme-independent HUD over every room (the default);
 * 'era' dresses the HUD to match each theme (bevelled 90s grey, riveted brass, neon glass...).
 * The secret arcade theme always brings its own cabinet chrome.
 */
export type UiStyle = 'modern' | 'era';

export const UI_STYLES: { id: UiStyle; name: string; blurb: string }[] = [
  { id: 'modern', name: 'Modern', blurb: 'Clean floating panels that sit lightly over every room' },
  { id: 'era', name: 'Classic (match the era)', blurb: 'Panels dressed for each theme: 90s grey bevels, brass rivets, neon glass' },
];

/** The chrome to draw for a scene theme under a UI style; null means the modern HUD. */
export const chromeFor = (theme: ThemeId, ui: UiStyle): ThemeId | null => (theme === 'arcade' ? 'arcade' : ui === 'era' ? theme : null);

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
