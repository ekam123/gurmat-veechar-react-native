import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAudioStore } from '@/stores/audioStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { togglePlayPause, stop } from '@/services/audioPlayer';
import { formatTrackName } from '@/utils/formatters';

const SWIPE_THRESHOLD = 100;

const TAB_BAR_HEIGHT = 49;

export default function NowPlayingBar() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentTrack, playbackStatus, position, duration } = useAudioStore();

  const translateX = useRef(new Animated.Value(0)).current;

  // Create pan responder for swipe gesture (left swipe only to remove)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes to the left
        return gestureState.dx < -10 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow left swipe (negative values)
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: async (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe out animation then stop
          Animated.timing(translateX, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
          }).start(async () => {
            await stop();
            translateX.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Hide on player and settings screens
  const shouldHide = pathname === '/player' || pathname === '/settings';

  if (!currentTrack || shouldHide) {
    return null;
  }

  const progress = duration > 0 ? position / duration : 0;
  const isPlaying = playbackStatus === 'playing';
  const isLoading = playbackStatus === 'loading';

  const handlePress = () => {
    router.push('/player' as any);
  };

  const handlePlayPause = async () => {
    await togglePlayPause();
  };

  // Position above tab bar with safe area
  const bottomPosition = TAB_BAR_HEIGHT + insets.bottom + 8;

  return (
    <View style={[styles.wrapper, { bottom: bottomPosition }]}>
      {/* Remove indicator - full width behind the card, revealed as card slides left */}
      <View style={styles.removeIndicator}>
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={styles.removeText}>Remove</Text>
      </View>

      {/* Card slides left to reveal the remove indicator */}
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={styles.touchable}
      >
        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.primary, width: `${progress * 100}%` },
            ]}
          />
        </View>

        <View style={styles.content}>
          {/* Track info */}
          <View style={styles.trackInfo}>
            <View style={[styles.albumArt, { backgroundColor: theme.primary }]}>
              <Ionicons name="musical-notes" size={20} color="#fff" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.trackName, { color: theme.text }]} numberOfLines={1}>
                {formatTrackName(currentTrack.trackName)}
              </Text>
              <Text style={[styles.folderName, { color: theme.textSecondary }]} numberOfLines={1}>
                {currentTrack.folderName}
              </Text>
            </View>
          </View>

          {/* Play/Pause button */}
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: theme.primary }]}
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            {isLoading ? (
              <Ionicons name="hourglass" size={20} color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    overflow: 'hidden',
    borderRadius: 12,
  },
  removeIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 24,
    gap: 6,
  },
  removeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  touchable: {
    width: '100%',
  },
  progressBar: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  albumArt: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
  },
  trackName: {
    fontSize: 14,
    fontWeight: '600',
  },
  folderName: {
    fontSize: 12,
    marginTop: 2,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
