import { create } from 'zustand';

// Maximum concurrent downloads to track
const MAX_ACTIVE_DOWNLOADS = 10;

export interface DownloadProgress {
  trackUrl: string;
  trackName: string;
  progress: number; // 0-1
  totalBytes: number;
  downloadedBytes: number;
}

export type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'error';

interface DownloadState {
  // Active downloads - using object instead of Map for better Zustand compatibility
  activeDownloads: Record<string, DownloadProgress>;
  downloadQueue: string[];
  status: DownloadStatus;
  error: string | null;

  // Actions
  startDownload: (trackUrl: string, trackName: string) => void;
  updateProgress: (trackUrl: string, progress: Partial<DownloadProgress>) => void;
  completeDownload: (trackUrl: string) => void;
  cancelDownload: (trackUrl: string) => void;
  setError: (error: string | null) => void;
  clearCompleted: () => void;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  activeDownloads: {},
  downloadQueue: [],
  status: 'idle',
  error: null,

  startDownload: (trackUrl, trackName) => {
    set((state) => {
      // Limit the number of active downloads tracked
      const activeCount = Object.keys(state.activeDownloads).length;
      if (activeCount >= MAX_ACTIVE_DOWNLOADS) {
        console.warn('Maximum active downloads reached, queueing download');
      }

      return {
        activeDownloads: {
          ...state.activeDownloads,
          [trackUrl]: {
            trackUrl,
            trackName,
            progress: 0,
            totalBytes: 0,
            downloadedBytes: 0,
          },
        },
        downloadQueue: [...state.downloadQueue, trackUrl],
        status: 'downloading',
      };
    });
  },

  updateProgress: (trackUrl, progress) => {
    set((state) => {
      const current = state.activeDownloads[trackUrl];
      if (!current) return state;

      return {
        activeDownloads: {
          ...state.activeDownloads,
          [trackUrl]: { ...current, ...progress },
        },
      };
    });
  },

  completeDownload: (trackUrl) => {
    set((state) => {
      const { [trackUrl]: removed, ...remainingDownloads } = state.activeDownloads;
      const newQueue = state.downloadQueue.filter((url) => url !== trackUrl);
      return {
        activeDownloads: remainingDownloads,
        downloadQueue: newQueue,
        status: newQueue.length > 0 ? 'downloading' : 'idle',
      };
    });
  },

  cancelDownload: (trackUrl) => {
    set((state) => {
      const { [trackUrl]: removed, ...remainingDownloads } = state.activeDownloads;
      const newQueue = state.downloadQueue.filter((url) => url !== trackUrl);
      return {
        activeDownloads: remainingDownloads,
        downloadQueue: newQueue,
        status: newQueue.length > 0 ? 'downloading' : 'idle',
      };
    });
  },

  setError: (error) => set({ error, status: error ? 'error' : get().status }),

  clearCompleted: () => {
    set((state) => {
      // Keep only downloads that are still in progress (progress < 1)
      const activeDownloads: Record<string, DownloadProgress> = {};
      const activeQueue: string[] = [];

      for (const [url, download] of Object.entries(state.activeDownloads)) {
        if (download.progress < 1 && state.downloadQueue.includes(url)) {
          activeDownloads[url] = download;
          activeQueue.push(url);
        }
      }

      return {
        activeDownloads,
        downloadQueue: activeQueue,
        status: activeQueue.length > 0 ? 'downloading' : 'idle',
      };
    });
  },
}));
