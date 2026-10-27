import { useTheme } from '@/lib/theme';

/** Returns the active Jaguar palette (follows the chosen accent theme). */
export function useColors() {
  const { palette } = useTheme();
  return { ...palette, radius: 16 };
}
