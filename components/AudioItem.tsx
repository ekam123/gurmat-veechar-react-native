import { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActionSheetIOS, Platform, Alert, ActivityIndicator, LayoutAnimation, UIManager } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore } from '@/stores/audioStore';
import { useDownloadStore } from '@/stores/downloadStore';
import { CachedFolder, Track } from '@/services/database';
import { formatTrackName, formatDuration } from '@/utils/formatters';

interface AudioItemProps {
  item: CachedFolder;
  trackInfo?: Track | null;
  onPress: () => void;
  onDownload?: () => void;
  onMarkComplete?: (completed: boolean) => void;
}

export default function AudioItem({ item, trackInfo, onPress, onDownload, onMarkComplete }: AudioItemProps) {
  const theme = useAppTheme();
  const { currentTrack, playbackStatus } = useAudioStore();
  const { activeDownloads } = useDownloadStore();

  const isCurrentTrack = currentTrack?.trackUrl === item.itemPath;
  const isPlaying = isCurrentTrack && playbackStatus === 'playing';
  const isDownloaded = trackInfo?.isDownloaded;
  const progress = trackInfo && trackInfo.trackDuration > 0
    ? trackInfo.currentPlaybackTime / trackInfo.trackDuration
    : 0;
  const isCompleted = trackInfo?.isCompleted;

  // Check if this track is currently downloading
  const isDownloading = !!activeDownloads[item.itemPath];

  // Track previous downloaded state to animate transitions
  const wasDownloaded = useRef(isDownloaded);
  useEffect(() => {
    if (wasDownloaded.current !== isDownloaded) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      wasDownloaded.current = isDownloaded;
    }
  }, [isDownloaded]);

  const handleLongPress = () => {
    const options = [];
    const actions: (() => void)[] = [];

    // Mark complete/incomplete option
    if (isCompleted) {
      options.push('Mark as Incomplete');
      actions.push(() => onMarkComplete?.(false));
    } else {
      options.push('Mark as Complete');
      actions.push(() => onMarkComplete?.(true));
    }

    // Download option (only if not downloaded and handler provided)
    if (!isDownloaded && onDownload) {
      options.push('Download Track');
      actions.push(onDownload);
    }

    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
        },
        (buttonIndex) => {
          if (buttonIndex < actions.length) {
            actions[buttonIndex]();
          }
        }
      );
    } else {
      // Android fallback using Alert
      Alert.alert(
        formatTrackName(item.itemName),
        undefined,
        [
          ...actions.map((action, index) => ({
            text: options[index],
            onPress: action,
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
        isCurrentTrack && { borderColor: theme.primary },
        isCompleted && !isCurrentTrack && styles.completedContainer,
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      delayLongPress={400}
    >
      <View style={[
        styles.icon,
        { backgroundColor: isCompleted && !isCurrentTrack ? theme.textSecondary + '20' : theme.secondary + '20' }
      ]}>
        <Ionicons
          name={isPlaying ? 'pause' : isCompleted ? 'checkmark' : 'play'}
          size={18}
          color={isCompleted && !isCurrentTrack ? theme.textSecondary : theme.secondary}
        />
      </View>

      <View style={styles.info}>
        <Text
          style={[
            styles.name,
            { color: theme.text },
            isCurrentTrack && { color: theme.primary },
          ]}
          numberOfLines={2}
        >
          {formatTrackName(item.itemName)}
        </Text>

        <View style={styles.meta}>
          {trackInfo?.trackDuration ? (
            <Text style={[styles.duration, { color: theme.textSecondary }]}>
              {formatDuration(trackInfo.trackDuration)}
            </Text>
          ) : null}

          {isDownloaded && (
            <View style={styles.downloadedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={theme.primary} />
            </View>
          )}
        </View>

        {/* Progress bar */}
        {progress > 0 && progress < 0.98 && (
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.primary, width: `${progress * 100}%` },
              ]}
            />
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        {/* Download button */}
        {onDownload && (
          <View style={styles.downloadButton}>
            {isDownloaded ? null : isDownloading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <TouchableOpacity
                onPress={onDownload}
                hitSlop={{ top: 5, bottom: 5, left: 10, right: 10 }}
              >
                <Ionicons name="download-outline" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {/* More options button */}
        <TouchableOpacity
          onPress={handleLongPress}
          hitSlop={{ top: 5, bottom: 5, left: 10, right: 10 }}
          style={styles.moreButton}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  completedContainer: {
    opacity: 0.6,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  duration: {
    fontSize: 12,
  },
  downloadedBadge: {
    marginLeft: 8,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  actionButtons: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  downloadButton: {
    width: 32,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 32,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
