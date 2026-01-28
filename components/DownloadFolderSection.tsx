import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';
import { GroupedDownloads, Track } from '@/services/database';
import { formatFileSize, getFolderDisplayName } from '@/utils/formatters';
import DownloadTrackItem from './DownloadTrackItem';

interface DownloadFolderSectionProps {
  group: GroupedDownloads;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPlayFolder: () => void;
  onPlayTrack: (track: Track) => void;
  onDeleteTrack: (track: Track) => void;
}

export default function DownloadFolderSection({
  group,
  isExpanded,
  onToggleExpand,
  onPlayFolder,
  onPlayTrack,
  onDeleteTrack,
}: DownloadFolderSectionProps) {
  const theme = useAppTheme();

  const displayName = group.folderName
    ? getFolderDisplayName(group.folderName)
    : 'Ungrouped';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={onToggleExpand}
        activeOpacity={0.7}
      >
        <View style={[styles.folderIcon, { backgroundColor: theme.primary + '20' }]}>
          <Ionicons
            name={group.folderName ? 'folder' : 'albums-outline'}
            size={20}
            color={theme.primary}
          />
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.folderName, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.folderMeta, { color: theme.textSecondary }]}>
            {group.trackCount} track{group.trackCount !== 1 ? 's' : ''} · {formatFileSize(group.totalSize)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: theme.primary }]}
          onPress={(e) => {
            e.stopPropagation?.();
            onPlayFolder();
          }}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Ionicons name="play" size={14} color="#fff" />
        </TouchableOpacity>

        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textSecondary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.trackList}>
          {group.tracks.map((track) => (
            <DownloadTrackItem
              key={track.trackUrl}
              track={track}
              onPress={() => onPlayTrack(track)}
              onDelete={() => onDeleteTrack(track)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
  },
  folderMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  trackList: {
    marginTop: 8,
    marginLeft: 16,
  },
});
