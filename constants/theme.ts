import { Platform } from 'react-native';
import { themes, ThemeName, ThemeColors } from '@/utils/constants';

export { themes, ThemeName, ThemeColors } from '@/utils/constants';

// Legacy Colors export for compatibility
export const Colors = {
  light: themes.default.light,
  dark: themes.default.dark,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/**
 * Get theme colors based on theme name and color scheme
 */
export function getThemeColors(themeName: ThemeName, colorScheme: 'light' | 'dark'): ThemeColors {
  return themes[themeName][colorScheme];
}
