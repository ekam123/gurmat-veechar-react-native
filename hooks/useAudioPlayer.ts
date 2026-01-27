import { useCallback } from 'react';
import { useAudioStore, QueueItem, buildQueueFromFolder } from '@/stores/audioStore';
import {
  playTrack,
  pause,
  resume,
  togglePlayPause,
  seekTo,
  skipForward,
  skipBackward,
  playNext,
  playPrevious,
  stop,
} from '@/services/audioPlayer';
import { CachedFolder } from '@/services/database';

/**
 * Hook to interact with the audio player
 */
export function useAudioPlayer() {
  const {
    currentTrack,
    playbackStatus,
    duration,
    position,
    buffered,
    error,
    queue,
    currentIndex,
    setQueue,
    clearQueue,
  } = useAudioStore();

  const isPlaying = playbackStatus === 'playing';
  const isLoading = playbackStatus === 'loading';
  const isPaused = playbackStatus === 'paused';
  const hasError = playbackStatus === 'error';

  const progress = duration > 0 ? position / duration : 0;
  const remaining = duration - position;

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < queue.length - 1;

  const play = useCallback(async (track: QueueItem) => {
    await playTrack(track);
  }, []);

  const playFromFolder = useCallback(
    async (
      items: CachedFolder[],
      folderPath: string,
      folderName: string,
      startIndex: number = 0
    ) => {
      const queueItems = buildQueueFromFolder(items, folderPath, folderName);
      if (queueItems.length === 0) return;

      setQueue(queueItems, startIndex);
      await playTrack(queueItems[startIndex]);
    },
    [setQueue]
  );

  const seek = useCallback(async (seconds: number) => {
    await seekTo(seconds);
  }, []);

  const seekToProgress = useCallback(
    async (progressValue: number) => {
      if (duration > 0) {
        await seekTo(progressValue * duration);
      }
    },
    [duration]
  );

  return {
    // State
    currentTrack,
    playbackStatus,
    duration,
    position,
    buffered,
    error,
    queue,
    currentIndex,
    progress,
    remaining,
    isPlaying,
    isLoading,
    isPaused,
    hasError,
    hasPrevious,
    hasNext,

    // Actions
    play,
    playFromFolder,
    pause,
    resume,
    togglePlayPause,
    seek,
    seekToProgress,
    skipForward,
    skipBackward,
    playNext,
    playPrevious,
    stop,
    setQueue,
    clearQueue,
  };
}
