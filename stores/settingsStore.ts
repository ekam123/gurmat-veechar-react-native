import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName } from '@/utils/constants';

interface SettingsState {
  themeName: ThemeName;
  autoplay: boolean;
  setThemeName: (theme: ThemeName) => void;
  setAutoplay: (autoplay: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeName: 'default',
      autoplay: true,

      setThemeName: (themeName) => set({ themeName }),
      setAutoplay: (autoplay) => set({ autoplay }),
    }),
    {
      name: 'gurmat-veechar-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
