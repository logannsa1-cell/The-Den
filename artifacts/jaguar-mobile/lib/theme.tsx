import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, type Palette, type ThemeId } from '@/constants/colors';

const KEY = 'jaguar:theme';

type Ctx = { themeId: ThemeId; palette: Palette; setTheme: (id: ThemeId) => void };
const ThemeContext = createContext<Ctx>({ themeId: 'violet', palette: THEMES.violet.palette, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('violet');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v && v in THEMES) setThemeId(v as ThemeId); }).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => ({
    themeId,
    palette: THEMES[themeId].palette,
    setTheme: (id) => { setThemeId(id); AsyncStorage.setItem(KEY, id).catch(() => {}); },
  }), [themeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
