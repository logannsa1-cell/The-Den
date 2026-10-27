/**
 * Jaguar palettes: near-black base with one predatory accent.
 * Mirrors the web artifact's [data-theme] blocks (violet default, rose, ocean, jungle).
 */
export type ThemeId = 'violet' | 'rose' | 'ocean' | 'jungle';

export type Palette = {
  background: string;
  backgroundAlt: string;
  card: string;
  cardRaised: string;
  border: string;
  borderStrong: string;
  foreground: string;
  text: string;
  mutedForeground: string;
  faint: string;
  primary: string;
  primarySoft: string;
  primaryLight: string;
  primaryDeep: string;
  primaryForeground: string;
  good: string;
  goodSoft: string;
  destructive: string;
  destructiveSoft: string;
  warn: string;
  tint: string;
};

const shared = { good: '#7fd3a4', goodSoft: '#7fd3a41f', destructive: '#f08a8a', destructiveSoft: '#f08a8a1f', warn: '#f2c879' };

export const THEMES: Record<ThemeId, { label: string; palette: Palette }> = {
  violet: {
    label: 'Violet',
    palette: {
      ...shared,
      background: '#0d0a12', backgroundAlt: '#120e19', card: '#16111d', cardRaised: '#1e1727', border: '#2c2338', borderStrong: '#3d3150',
      foreground: '#efe8f8', text: '#efe8f8', mutedForeground: '#9a8fab', faint: '#6c6279',
      primary: '#a879f2', primarySoft: '#a879f224', primaryLight: '#c9a6ff', primaryDeep: '#6d28d9', primaryForeground: '#16091f', tint: '#a879f2',
    },
  },
  rose: {
    label: 'Rose',
    palette: {
      ...shared,
      background: '#100a0d', backgroundAlt: '#160e12', card: '#1a1116', cardRaised: '#23161d', border: '#382530', borderStrong: '#4e3341',
      foreground: '#f8e9ef', text: '#f8e9ef', mutedForeground: '#ab8f9b', faint: '#7a6370',
      primary: '#ef7fa8', primarySoft: '#ef7fa824', primaryLight: '#ffb0cb', primaryDeep: '#b8346a', primaryForeground: '#22070f', tint: '#ef7fa8',
    },
  },
  ocean: {
    label: 'Ocean',
    palette: {
      ...shared,
      background: '#090c11', backgroundAlt: '#0d121a', card: '#10161e', cardRaised: '#161e29', border: '#223040', borderStrong: '#2f4257',
      foreground: '#e7f1f8', text: '#e7f1f8', mutedForeground: '#8c9cab', faint: '#5f6f7e',
      primary: '#5fb7e8', primarySoft: '#5fb7e824', primaryLight: '#9ad5f5', primaryDeep: '#1f6f9e', primaryForeground: '#04131c', tint: '#5fb7e8',
    },
  },
  jungle: {
    label: 'Jungle',
    palette: {
      ...shared,
      background: '#0a0d0a', backgroundAlt: '#0e130f', card: '#121812', cardRaised: '#19211a', border: '#25332a', borderStrong: '#34473a',
      foreground: '#e9f4ea', text: '#e9f4ea', mutedForeground: '#90a392', faint: '#627364',
      primary: '#7fcf8c', primarySoft: '#7fcf8c24', primaryLight: '#b0e8b8', primaryDeep: '#2f7a3d', primaryForeground: '#06160a', tint: '#7fcf8c',
    },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

const colors = { light: THEMES.violet.palette, radius: 16 };
export default colors;
