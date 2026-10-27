import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

export type ThemeName = 'violet' | 'rose' | 'ocean' | 'jungle';
export type ThemeSpec = { id: ThemeName; label: string; accent: string; accentInk: string; bg: string; surface: string; text: string; muted: string; line: string };

export const THEMES: ThemeSpec[] = [
  { id: 'violet', label: 'Violet', accent: '#a879f2', accentInk: '#16091f', bg: '#0d0a12', surface: '#16111d', text: '#efe8f8', muted: '#9a8fab', line: '#2c2338' },
  { id: 'rose', label: 'Rose', accent: '#ef7fa8', accentInk: '#22070f', bg: '#100a0d', surface: '#1a1116', text: '#f8e9ef', muted: '#ab8f9b', line: '#382530' },
  { id: 'ocean', label: 'Ocean', accent: '#5fb7e8', accentInk: '#04131c', bg: '#090c11', surface: '#10161e', text: '#e7f1f8', muted: '#8c9cab', line: '#223040' },
  { id: 'jungle', label: 'Jungle', accent: '#7fcf8c', accentInk: '#06160a', bg: '#0a0d0a', surface: '#121812', text: '#e9f4ea', muted: '#90a392', line: '#25332a' },
];

const KEY = 'jaguar-theme';
function readTheme(): ThemeName {
  try {
    const value = localStorage.getItem(KEY);
    return THEMES.some((t) => t.id === value) ? (value as ThemeName) : 'violet';
  } catch { return 'violet'; }
}
document.documentElement.dataset.theme = readTheme();

const ThemeContext = createContext<{ theme: ThemeSpec; setTheme: (id: ThemeName) => void }>({ theme: THEMES[0], setTheme: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeName>(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', THEMES.find((t) => t.id === id)!.bg);
  }, [id]);
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  return <ThemeContext.Provider value={{ theme, setTheme: setId }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
