import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

export type ThemeName = 'rose' | 'violet';
export type ThemeSpec = { id: ThemeName; label: string; accent: string; accentInk: string; bg: string; surface: string; text: string; muted: string; line: string };

export const THEMES: ThemeSpec[] = [
  { id: 'rose', label: 'Rose', accent: '#c88da0', accentInk: '#211318', bg: '#181719', surface: '#262426', text: '#f1eaed', muted: '#c0b8bc', line: '#3c383a' },
  { id: 'violet', label: 'Violet', accent: '#a996c2', accentInk: '#19151e', bg: '#18181b', surface: '#262529', text: '#f0edf3', muted: '#c1bdc6', line: '#3d3a40' },
];

const KEY = 'jaguar-theme';
function readTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'violet' ? 'violet' : 'rose';
  } catch { return 'rose'; }
}
document.documentElement.dataset.theme = readTheme();

const ThemeContext = createContext<{ theme: ThemeSpec; setTheme: (id: ThemeName) => void }>({
  theme: THEMES[0],
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeName>(readTheme);
  const theme = THEMES.find((item) => item.id === id) ?? THEMES[0];
  useEffect(() => {
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme.bg);
  }, [id, theme.bg]);
  return <ThemeContext.Provider value={{ theme, setTheme: setId }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
