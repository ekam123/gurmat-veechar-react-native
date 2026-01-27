import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore } from '@/stores/audioStore';
import {
  togglePlayPause,
  playNext,
  playPrevious,
  skipForward,
  skipBackward,
} from '@/services/audioPlayer';

interface PlayerControlsProps {
  size?: 'small' | 'large';
}

export default function PlayerControls({ size = 'large' }: PlayerControlsProps) {
  const theme = useAppTheme();
  const { playbackStatus, queue, currentIndex } = useAudioStore();

  const isPlaying = playbackStatus === 'playing';
  const isLoading = playbackStatus === 'loading';
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < queue.length - 1;

  const isLarge = size === 'large';
  const mainButtonSize = isLarge ? 72 : 48;
  const mainIconSize = isLarge ? 32 : 24;
  const sideButtonSize = isLarge ? 48 : 36;
  const sideIconSize = isLarge ? 24 : 18;
  const skipButtonSize = isLarge ? 40 : 32;
  const skipIconSize = isLarge ? 20 : 16;

  return (
    <View style={styles.container}>
      {/* Skip backward 15s */}
      {isLarge && (
        <TouchableOpacity
          style={[styles.skipButton, { width: skipButtonSize, height: skipButtonSize }]}
          onPress={() => skipBackward(15)}
        >
          <Ionicons name="play-back" size={skipIconSize} color={theme.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Previous track */}
      <TouchableOpacity
        style={[
          styles.sideButton,
          { width: sideButtonSize, height: sideButtonSize },
          !hasPrevious && styles.disabledButton,
        ]}
        onPress={playPrevious}
        disabled={!hasPrevious && currentIndex === 0}
      >
        <Ionicons
          name="play-skip-back"
          size={sideIconSize}
          color={hasPrevious ? theme.text : theme.textSecondary}
        />
      </TouchableOpacity>

      {/* Play/Pause */}
      <TouchableOpacity
        style={[
          styles.mainButton,
          { width: mainButtonSize, height: mainButtonSize, backgroundColor: theme.primary },
        ]}
        onPress={togglePlayPause}
        disabled={isLoading}
      >
        {isLoading ? (
          <Ionicons name="hourglass" size={mainIconSize} color="#fff" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={mainIconSize} color="#fff" />
        )}
      </TouchableOpacity>

      {/* Next track */}
      <TouchableOpacity
        style={[
          styles.sideButton,
          { width: sideButtonSize, height: sideButtonSize },
          !hasNext && styles.disabledButton,
        ]}
        onPress={playNext}
        disabled={!hasNext}
      >
        <Ionicons
          name="play-skip-forward"
          size={sideIconSize}
          color={hasNext ? theme.text : theme.textSecondary}
        />
      </TouchableOpacity>

      {/* Skip forward 15s */}
      {isLarge && (
        <TouchableOpacity
          style={[styles.skipButton, { width: skipButtonSize, height: skipButtonSize }]}
          onPress={() => skipForward(15)}
        >
          <Ionicons name="play-forward" size={skipIconSize} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButton: {
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  sideButton: {
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  skipButton: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
