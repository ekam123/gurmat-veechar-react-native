import { create } from 'zustand';
import { CachedFolder } from '@/services/database';

// Maximum queue size to prevent memory issues
const MAX_QUEUE_SIZE = 500;

export interface QueueItem {
  trackUrl: string;
  trackName: string;
  folderPath: string;
  folderName: string;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface AudioState {
  // Current track
  currentTrack: QueueItem | null;
  playbackStatus: PlaybackStatus;
  duration: number;
  position: number;
  buffered: number;
  error: string | null;
  playbackSpeed: number;

  // Queue
  queue: QueueItem[];
  currentIndex: number;

  // Actions
  setCurrentTrack: (track: QueueItem | null) => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setDuration: (duration: number) => void;
  setPosition: (position: number) => void;
  setBuffered: (buffered: number) => void;
  setError: (error: string | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  setQueue: (queue: QueueItem[], startIndex?: number) => void;
  nextTrack: () => QueueItem | null;
  previousTrack: () => QueueItem | null;
  clearQueue: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  currentTrack: null,
  playbackStatus: 'idle',
  duration: 0,
  position: 0,
  buffered: 0,
  error: null,
  playbackSpeed: 1,
  queue: [],
  currentIndex: -1,

  setCurrentTrack: (track) => set({ currentTrack: track, error: null }),

  setPlaybackStatus: (status) => set({ playbackStatus: status }),

  setDuration: (duration) => set({ duration }),

  setPosition: (position) => set({ position }),

  setBuffered: (buffered) => set({ buffered }),

  setError: (error) => set({ error, playbackStatus: error ? 'error' : get().playbackStatus }),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setQueue: (queue, startIndex = 0) => {
    // Limit queue size to prevent memory issues
    // Keep a window around the start index if queue is too large
    let limitedQueue = queue;
    let adjustedIndex = startIndex;

    if (queue.length > MAX_QUEUE_SIZE) {
      // Calculate start position to keep startIndex centered if possible
      const halfWindow = Math.floor(MAX_QUEUE_SIZE / 2);
      let windowStart = Math.max(0, startIndex - halfWindow);
      let windowEnd = windowStart + MAX_QUEUE_SIZE;

      // Adjust if we're near the end
      if (windowEnd > queue.length) {
        windowEnd = queue.length;
        windowStart = Math.max(0, windowEnd - MAX_QUEUE_SIZE);
      }

      limitedQueue = queue.slice(windowStart, windowEnd);
      adjustedIndex = startIndex - windowStart;
    }

    set({
      queue: limitedQueue,
      currentIndex: adjustedIndex,
      currentTrack: limitedQueue[adjustedIndex] || null,
    });
  },

  nextTrack: () => {
    const { queue, currentIndex } = get();
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      const nextTrack = queue[nextIndex];
      set({ currentIndex: nextIndex, currentTrack: nextTrack });
      return nextTrack;
    }
    return null;
  },

  previousTrack: () => {
    const { queue, currentIndex } = get();
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      const prevTrack = queue[prevIndex];
      set({ currentIndex: prevIndex, currentTrack: prevTrack });
      return prevTrack;
    }
    return null;
  },

  clearQueue: () =>
    set({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      playbackStatus: 'idle',
      position: 0,
      duration: 0,
    }),
}));

/**
 * Build queue from folder items
 */
export function buildQueueFromFolder(
  items: CachedFolder[],
  folderPath: string,
  folderName: string
): QueueItem[] {
  return items
    .filter((item) => item.itemType === 'audio')
    .map((item) => ({
      trackUrl: item.itemPath,
      trackName: item.itemName,
      folderPath,
      folderName,
    }));
}
