import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore } from '@/stores/audioStore';
import { CachedFolder, Track } from '@/services/database';
import { formatTrackName, formatDuration } from '@/utils/formatters';

interface AudioItemProps {
  item: CachedFolder;
  trackInfo?: Track | null;
  onPress: () => void;
  onDownload?: () => void;
}

export default function AudioItem({ item, trackInfo, onPress, onDownload }: AudioItemProps) {
  const theme = useAppTheme();
  const { currentTrack, playbackStatus } = useAudioStore();

  const isCurrentTrack = currentTrack?.trackUrl === item.itemPath;
  const isPlaying = isCurrentTrack && playbackStatus === 'playing';
  const isDownloaded = trackInfo?.isDownloaded;
  const progress = trackInfo && trackInfo.trackDuration > 0
    ? trackInfo.currentPlaybackTime / trackInfo.trackDuration
    : 0;
  const isCompleted = trackInfo?.isCompleted;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
        isCurrentTrack && { borderColor: theme.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.icon, { backgroundColor: theme.secondary + '20' }]}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color={theme.secondary}
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

          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-done" size={12} color={theme.textSecondary} />
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

      {onDownload && !isDownloaded && (
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={onDownload}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="download-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
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
  completedBadge: {
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
  downloadButton: {
    padding: 8,
  },
});
