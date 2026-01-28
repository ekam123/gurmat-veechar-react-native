import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore } from '@/stores/audioStore';
import { Track } from '@/services/database';
import { formatTrackName, formatFileSize, formatDuration } from '@/utils/formatters';

interface DownloadTrackItemProps {
  track: Track;
  onPress: () => void;
  onDelete: () => void;
}

export default function DownloadTrackItem({ track, onPress, onDelete }: DownloadTrackItemProps) {
  const theme = useAppTheme();
  const { currentTrack, playbackStatus } = useAudioStore();

  const isCurrentTrack = currentTrack?.trackUrl === track.trackUrl;
  const isPlaying = isCurrentTrack && playbackStatus === 'playing';

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
      <View style={[styles.icon, { backgroundColor: theme.primary + '20' }]}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={theme.primary}
        />
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: theme.text }, isCurrentTrack && { color: theme.primary }]}
          numberOfLines={2}
        >
          {formatTrackName(track.trackName)}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {formatFileSize(track.trackSizeBytes)}
          </Text>
          {track.trackDuration > 0 && (
            <>
              <Text style={[styles.metaDot, { color: theme.textSecondary }]}> · </Text>
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {formatDuration(track.trackDuration)}
              </Text>
            </>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
      </TouchableOpacity>
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
    marginBottom: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
  },
  metaDot: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
});
