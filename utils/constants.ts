// API and URL constants
export const BASE_URL = 'https://gurmatveechar.com';
export const AUDIO_BASE_URL = 'https://gurmatveechar.com/audios';

// Cache settings
export const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const SQLITE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Playback settings
export const COMPLETION_THRESHOLD = 0.98; // 98% = complete

// Theme definitions
export type ThemeName = 'default' | 'purple' | 'navy' | 'forest';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  card: string;
  tabBar: string;
}

export const themes: Record<ThemeName, { light: ThemeColors; dark: ThemeColors }> = {
  default: {
    light: {
      primary: '#3366CC',
      secondary: '#FF8033',
      background: '#F5F5F5',
      surface: '#FFFFFF',
      text: '#11181C',
      textSecondary: '#687076',
      border: '#E5E5E5',
      card: '#FFFFFF',
      tabBar: '#FFFFFF',
    },
    dark: {
      primary: '#5588EE',
      secondary: '#FF9955',
      background: '#0A0A0A',
      surface: '#1A1A1A',
      text: '#ECEDEE',
      textSecondary: '#9BA1A6',
      border: '#2A2A2A',
      card: '#1A1A1A',
      tabBar: '#1A1A1A',
    },
  },
  purple: {
    light: {
      primary: '#6B5B95',
      secondary: '#D4A574',
      background: '#F5F3F7',
      surface: '#FFFFFF',
      text: '#11181C',
      textSecondary: '#687076',
      border: '#E5E5E5',
      card: '#FFFFFF',
      tabBar: '#FFFFFF',
    },
    dark: {
      primary: '#8B7BB5',
      secondary: '#E4B584',
      background: '#0A090B',
      surface: '#1A191B',
      text: '#ECEDEE',
      textSecondary: '#9BA1A6',
      border: '#2A2A2A',
      card: '#1A191B',
      tabBar: '#1A191B',
    },
  },
  navy: {
    light: {
      primary: '#1A365D',
      secondary: '#C9A227',
      background: '#F0F4F8',
      surface: '#FFFFFF',
      text: '#11181C',
      textSecondary: '#687076',
      border: '#E5E5E5',
      card: '#FFFFFF',
      tabBar: '#FFFFFF',
    },
    dark: {
      primary: '#3A567D',
      secondary: '#D9B237',
      background: '#0A0B0D',
      surface: '#1A1B1D',
      text: '#ECEDEE',
      textSecondary: '#9BA1A6',
      border: '#2A2A2A',
      card: '#1A1B1D',
      tabBar: '#1A1B1D',
    },
  },
  forest: {
    light: {
      primary: '#2D5016',
      secondary: '#8B4513',
      background: '#F2F5F0',
      surface: '#FFFFFF',
      text: '#11181C',
      textSecondary: '#687076',
      border: '#E5E5E5',
      card: '#FFFFFF',
      tabBar: '#FFFFFF',
    },
    dark: {
      primary: '#4D7036',
      secondary: '#AB6533',
      background: '#090B08',
      surface: '#191B19',
      text: '#ECEDEE',
      textSecondary: '#9BA1A6',
      border: '#2A2A2A',
      card: '#191B19',
      tabBar: '#191B19',
    },
  },
};

// Root categories for browse screen
export const ROOT_CATEGORIES = [
  {
    id: 'katha',
    title: 'Katha',
    subtitle: 'Sikh discourses & explanations',
    path: '/Katha',
    icon: 'mic',
  },
  {
    id: 'keertan',
    title: 'Keertan',
    subtitle: 'Devotional hymns & music',
    path: '/Keertan',
    icon: 'musical-notes',
  },
  {
    id: 'santhya',
    title: 'Gurbani Santhya',
    subtitle: 'Correct pronunciation lessons',
    path: '/Gurbani_Santhya',
    icon: 'school',
  },
  {
    id: 'ucharan',
    title: 'Gurbani Ucharan',
    subtitle: 'Recitation recordings',
    path: '/Gurbani_Ucharan',
    icon: 'volume-high',
  },
];
