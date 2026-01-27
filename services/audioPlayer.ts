import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { useAudioStore, QueueItem } from '@/stores/audioStore';
import { useSettingsStore } from '@/stores/settingsStore';
import * as database from '@/services/database';
import { COMPLETION_THRESHOLD } from '@/utils/constants';
import { formatTrackName } from '@/utils/formatters';

let player: AudioPlayer | null = null;
let positionUpdateInterval: ReturnType<typeof setInterval> | null = null;
let statusSubscription: { remove: () => void } | null = null;

/**
 * Initialize audio player with proper audio mode settings
 */
export async function initAudioPlayer(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'duckOthers',
  });
}

/**
 * Load and play a track
 */
export async function playTrack(track: QueueItem): Promise<void> {
  const store = useAudioStore.getState();

  try {
    // Unload previous track
    await unloadTrack();

    store.setCurrentTrack(track);
    store.setPlaybackStatus('loading');
    store.setPosition(0);
    store.setDuration(0);

    // Check if track is downloaded locally
    const savedTrack = await database.getTrack(track.trackUrl);
    let uri = track.trackUrl;

    if (savedTrack?.isDownloaded && savedTrack.localFilePath) {
      uri = savedTrack.localFilePath;
    }

    // Create new player
    player = createAudioPlayer({ uri }, { updateInterval: 500 });

    // Subscribe to status updates
    statusSubscription = player.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);

    // Wait for player to be loaded
    await waitForLoad();

    // Restore playback position if available and not completed
    if (savedTrack && savedTrack.currentPlaybackTime > 0 && !savedTrack.isCompleted) {
      await player.seekTo(savedTrack.currentPlaybackTime);
    }

    // Start playback
    player.play();

    // Set up lock screen controls (if available)
    if (typeof player.setActiveForLockScreen === 'function') {
      player.setActiveForLockScreen(true, {
        title: formatTrackName(track.trackName),
        artist: track.folderName,
      });
    }

    // Ensure track exists in database
    await database.upsertTrack({
      trackUrl: track.trackUrl,
      trackName: track.trackName,
    });

    // Start position saving interval
    startPositionSaving();
  } catch (error) {
    console.error('Error playing track:', error);
    store.setError(error instanceof Error ? error.message : 'Failed to play track');
    store.setPlaybackStatus('error');
  }
}

/**
 * Wait for player to finish loading
 */
function waitForLoad(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!player) {
      reject(new Error('No player'));
      return;
    }

    if (player.isLoaded) {
      resolve();
      return;
    }

    const checkLoaded = setInterval(() => {
      if (!player) {
        clearInterval(checkLoaded);
        reject(new Error('Player removed'));
        return;
      }
      if (player.isLoaded) {
        clearInterval(checkLoaded);
        resolve();
      }
    }, 100);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkLoaded);
      reject(new Error('Load timeout'));
    }, 30000);
  });
}

/**
 * Handle playback status updates
 */
function onPlaybackStatusUpdate(): void {
  if (!player) return;

  const store = useAudioStore.getState();

  // Update duration
  if (player.duration > 0) {
    store.setDuration(player.duration);
  }

  // Update position
  store.setPosition(player.currentTime);

  // Update playback status
  if (player.playing) {
    store.setPlaybackStatus('playing');
  } else if (player.isBuffering) {
    store.setPlaybackStatus('loading');
  } else if (player.paused) {
    store.setPlaybackStatus('paused');
  }

  // Handle track completion (when position reaches end)
  if (player.duration > 0 && player.currentTime >= player.duration - 0.5 && !player.playing) {
    handleTrackCompletion();
  }
}

/**
 * Handle when a track finishes playing
 */
async function handleTrackCompletion(): Promise<void> {
  const store = useAudioStore.getState();
  const settings = useSettingsStore.getState();
  const currentTrack = store.currentTrack;

  // Mark track as completed
  if (currentTrack) {
    await database.updateTrackPosition(currentTrack.trackUrl, 0, true);
  }

  // Autoplay next track if enabled
  if (settings.autoplay) {
    const nextTrack = store.nextTrack();
    if (nextTrack) {
      await playTrack(nextTrack);
    } else {
      store.setPlaybackStatus('paused');
    }
  } else {
    store.setPlaybackStatus('paused');
  }
}

/**
 * Start periodic position saving
 */
function startPositionSaving(): void {
  stopPositionSaving();

  positionUpdateInterval = setInterval(async () => {
    if (!player) return;

    const store = useAudioStore.getState();
    const { currentTrack, playbackStatus } = store;
    const position = player.currentTime;
    const duration = player.duration;

    if (currentTrack && playbackStatus === 'playing' && position > 0) {
      const progress = duration > 0 ? position / duration : 0;
      const isCompleted = progress >= COMPLETION_THRESHOLD;

      await database.updateTrackPosition(currentTrack.trackUrl, position, isCompleted);
    }
  }, 5000); // Save every 5 seconds
}

/**
 * Stop position saving interval
 */
function stopPositionSaving(): void {
  if (positionUpdateInterval) {
    clearInterval(positionUpdateInterval);
    positionUpdateInterval = null;
  }
}

/**
 * Pause playback
 */
export async function pause(): Promise<void> {
  if (player) {
    player.pause();
    useAudioStore.getState().setPlaybackStatus('paused');
  }
}

/**
 * Resume playback
 */
export async function resume(): Promise<void> {
  if (player) {
    player.play();
    useAudioStore.getState().setPlaybackStatus('playing');
  }
}

/**
 * Toggle play/pause
 */
export async function togglePlayPause(): Promise<void> {
  const status = useAudioStore.getState().playbackStatus;
  if (status === 'playing') {
    await pause();
  } else if (status === 'paused') {
    await resume();
  }
}

/**
 * Seek to position (in seconds)
 */
export async function seekTo(position: number): Promise<void> {
  if (player) {
    await player.seekTo(position);
    useAudioStore.getState().setPosition(position);
  }
}

/**
 * Skip forward by seconds
 */
export async function skipForward(seconds: number = 15): Promise<void> {
  if (!player) return;
  const duration = player.duration;
  const currentPosition = player.currentTime;
  const newPosition = Math.min(currentPosition + seconds, duration);
  await seekTo(newPosition);
}

/**
 * Skip backward by seconds
 */
export async function skipBackward(seconds: number = 15): Promise<void> {
  if (!player) return;
  const currentPosition = player.currentTime;
  const newPosition = Math.max(currentPosition - seconds, 0);
  await seekTo(newPosition);
}

/**
 * Play next track in queue
 */
export async function playNext(): Promise<void> {
  const nextTrack = useAudioStore.getState().nextTrack();
  if (nextTrack) {
    await playTrack(nextTrack);
  }
}

/**
 * Play previous track in queue
 */
export async function playPrevious(): Promise<void> {
  if (!player) return;

  const position = player.currentTime;

  // If more than 3 seconds into track, restart it
  if (position > 3) {
    await seekTo(0);
    return;
  }

  const prevTrack = useAudioStore.getState().previousTrack();
  if (prevTrack) {
    await playTrack(prevTrack);
  } else {
    // Restart current track
    await seekTo(0);
  }
}

/**
 * Unload current track
 */
export async function unloadTrack(): Promise<void> {
  stopPositionSaving();

  // Save final position before unloading
  const store = useAudioStore.getState();
  if (player && store.currentTrack && player.currentTime > 0) {
    const progress = player.duration > 0 ? player.currentTime / player.duration : 0;
    await database.updateTrackPosition(
      store.currentTrack.trackUrl,
      player.currentTime,
      progress >= COMPLETION_THRESHOLD
    );
  }

  // Remove status subscription
  if (statusSubscription) {
    statusSubscription.remove();
    statusSubscription = null;
  }

  // Remove player
  if (player) {
    // Stop playback first
    player.pause();

    // Clear lock screen controls (if available)
    if (typeof player.setActiveForLockScreen === 'function') {
      player.setActiveForLockScreen(false);
    }
    player.remove();
    player = null;
  }
}

/**
 * Stop playback and clear state
 */
export async function stop(): Promise<void> {
  await unloadTrack();
  useAudioStore.getState().clearQueue();
}

/**
 * Get current player instance (for advanced usage)
 */
export function getPlayer(): AudioPlayer | null {
  return player;
}
