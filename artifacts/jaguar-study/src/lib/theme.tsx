import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

export type ThemeName = 'rose' | 'violet';
export type ThemeSpec = { id: ThemeName; label: string; accent: string; accentInk: string; bg: string; surface: string; text: string; muted: string; line: string };

export const THEMES: ThemeSpec[] = [
  { id: 'rose', label: 'Rose', accent: '#c88da0', accentInk: '#211318', bg: '#0b0a0c', surface: '#191619', text: '#f1eaed', muted: '#c0b8bc', line: '#322d30' },
  { id: 'violet', label: 'Violet', accent: '#a996c2', accentInk: '#19151e', bg: '#0b0b0d', surface: '#19181d', text: '#f0edf3', muted: '#c1bdc6', line: '#322f37' },
];

const KEY = 'jaguar-theme';
function readTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'rose' || saved === 'violet' ? saved : 'violet';
  } catch { return 'violet'; }
}
document.documentElement.dataset.theme = readTheme();

const ThemeContext = createContext<{ theme: ThemeSpec; setTheme: (id: ThemeName) => void }>({
  theme: THEMES[1],
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeName>(readTheme);
  const theme = THEMES.find((item) => item.id === id) ?? THEMES[1];
  useEffect(() => {
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme.bg);
  }, [id, theme.bg]);
  return <ThemeContext.Provider value={{ theme, setTheme: setId }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
