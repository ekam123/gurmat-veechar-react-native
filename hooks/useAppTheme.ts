import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/stores/settingsStore';
import { getThemeColors, ThemeColors } from '@/constants/theme';

/**
 * Hook to get current app theme colors based on settings and system color scheme
 */
export function useAppTheme(): ThemeColors {
  const colorScheme = useColorScheme() ?? 'light';
  const themeName = useSettingsStore((state) => state.themeName);
  return getThemeColors(themeName, colorScheme);
}

/**
 * Hook to get specific theme color
 */
export function useThemeColor<K extends keyof ThemeColors>(colorName: K): string {
  const theme = useAppTheme();
  return theme[colorName];
}
