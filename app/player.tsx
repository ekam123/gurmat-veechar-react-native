import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore } from '@/stores/audioStore';
import { seekTo, cyclePlaybackSpeed } from '@/services/audioPlayer';
import PlayerControls from '@/components/PlayerControls';
import { formatTrackName, formatDuration } from '@/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Extract just the title part from track name
 * For format like "Person - 045 - Title", returns just "Title"
 */
function getTrackTitle(name: string): string {
  if (!name) return '';

  // Remove .mp3 extension
  const withoutExt = name.replace(/\.mp3$/i, '');

  // Split by " - " to find parts
  const parts = withoutExt.split(/\s*-\s*/);

  // Find the index of a purely numeric part (track number)
  const numberIndex = parts.findIndex((part) => /^\d+$/.test(part));

  // If we found a number, take everything after it as the title
  if (numberIndex !== -1 && numberIndex < parts.length - 1) {
    return parts.slice(numberIndex + 1).join(' - ').trim();
  }

  // Fallback to formatted track name
  return formatTrackName(name);
}

export default function PlayerScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentTrack, position, duration, queue, currentIndex, playbackSpeed } = useAudioStore();

  if (!currentTrack) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes-outline" size={80} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No track playing
          </Text>
        </View>
      </View>
    );
  }

  const handleSeek = async (value: number) => {
    await seekTo(value);
  };

  const handleSpeedChange = () => {
    cyclePlaybackSpeed();
  };

  const formatSpeed = (speed: number) => {
    return speed === 1 ? '1x' : `${speed}x`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={28} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.textSecondary }]}>
            Now Playing
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.text }]} numberOfLines={1}>
            {getTrackTitle(currentTrack.trackName)}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Artwork */}
      <View style={styles.artworkContainer}>
        <View style={[styles.artwork, { backgroundColor: theme.primary }]}>
          <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.8)" />
        </View>
      </View>

      {/* Track Info */}
      <View style={styles.trackInfo}>
        <Text style={[styles.trackName, { color: theme.text }]} numberOfLines={2}>
          {formatTrackName(currentTrack.trackName)}
        </Text>
        <Text style={[styles.folderName, { color: theme.textSecondary }]} numberOfLines={1}>
          {getTrackTitle(currentTrack.trackName)}
        </Text>
      </View>

      {/* Speed Button */}
      <TouchableOpacity onPress={handleSpeedChange} style={styles.speedButton}>
        <Text style={[styles.speedText, { color: theme.primary }]}>
          {formatSpeed(playbackSpeed)}
        </Text>
      </TouchableOpacity>

      {/* Progress Slider */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          value={position}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
        />
        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { color: theme.textSecondary }]}>
            {formatDuration(position)}
          </Text>
          <Text style={[styles.timeText, { color: theme.textSecondary }]}>
            {formatDuration(duration)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <PlayerControls size="large" />
      </View>

      {/* Queue Info */}
      <View style={[styles.queueInfo, { paddingBottom: insets.bottom + 20 }]}>
        {queue.length > 1 && (
          <TouchableOpacity
            onPress={() => {
              if (currentTrack?.folderPath) {
                router.dismiss();
                router.push(`/browse/folder/${encodeURIComponent(currentTrack.folderPath)}` as any);
              }
            }}
          >
            <Text style={[styles.queueText, { color: theme.primary }]}>
              Track {currentIndex + 1} of {queue.length}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  artwork: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    maxWidth: 320,
    maxHeight: 320,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  trackInfo: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  trackName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  folderName: {
    fontSize: 16,
    marginTop: 8,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  controlsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  speedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  queueInfo: {
    alignItems: 'center',
    marginTop: 16,
  },
  queueText: {
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
  },
});
