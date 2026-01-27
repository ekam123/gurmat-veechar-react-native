import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore } from '@/stores/audioStore';
import { getDownloadedTracks, Track } from '@/services/database';
import { deleteDownload, getTotalDownloadsSize, deleteAllDownloads } from '@/services/downloadManager';
import { playTrack } from '@/services/audioPlayer';
import { formatTrackName, formatFileSize, formatDuration, formatRelativeDate } from '@/utils/formatters';

export default function DownloadsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [downloads, setDownloads] = useState<Track[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { currentTrack, playbackStatus } = useAudioStore();

  const loadDownloads = async () => {
    try {
      const data = await getDownloadedTracks();
      setDownloads(data);
      const size = await getTotalDownloadsSize();
      setTotalSize(size);
    } catch (error) {
      console.error('Error loading downloads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDownloads();
    }, [])
  );

  // Memoize the queue to avoid recreating on every render
  const downloadsQueue = useMemo(() => {
    return downloads.map((d) => ({
      trackUrl: d.trackUrl,
      trackName: d.trackName,
      folderPath: 'Downloads',
      folderName: 'Downloads',
    }));
  }, [downloads]);

  const handlePlay = async (track: Track) => {
    const index = downloads.findIndex((d) => d.trackUrl === track.trackUrl);
    useAudioStore.getState().setQueue(downloadsQueue, index);

    await playTrack({
      trackUrl: track.trackUrl,
      trackName: track.trackName,
      folderPath: 'Downloads',
      folderName: 'Downloads',
    });
  };

  const handleDelete = (track: Track) => {
    Alert.alert(
      'Delete Download',
      `Delete "${formatTrackName(track.trackName)}"? This will remove the downloaded file.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDownload(track.trackUrl);
            setDownloads((prev) => prev.filter((d) => d.trackUrl !== track.trackUrl));
            setTotalSize((prev) => prev - (track.trackSizeBytes || 0));
          },
        },
      ]
    );
  };

  const handleDeleteAll = () => {
    if (downloads.length === 0) return;

    Alert.alert(
      'Delete All Downloads',
      `Delete all ${downloads.length} downloaded tracks? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllDownloads();
            setDownloads([]);
            setTotalSize(0);
          },
        },
      ]
    );
  };

  const isCurrentTrack = (track: Track) => currentTrack?.trackUrl === track.trackUrl;
  const isPlaying = (track: Track) => isCurrentTrack(track) && playbackStatus === 'playing';

  const renderItem = ({ item }: { item: Track }) => (
    <TouchableOpacity
      style={[
        styles.item,
        { backgroundColor: theme.card, borderColor: theme.border },
        isCurrentTrack(item) && { borderColor: theme.primary },
      ]}
      onPress={() => handlePlay(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.icon, { backgroundColor: theme.primary + '20' }]}>
        <Ionicons
          name={isPlaying(item) ? 'pause' : 'play'}
          size={20}
          color={theme.primary}
        />
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: theme.text }, isCurrentTrack(item) && { color: theme.primary }]}
          numberOfLines={2}
        >
          {formatTrackName(item.trackName)}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {formatFileSize(item.trackSizeBytes)}
          </Text>
          {item.trackDuration > 0 && (
            <>
              <Text style={[styles.metaDot, { color: theme.textSecondary }]}> · </Text>
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {formatDuration(item.trackDuration)}
              </Text>
            </>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="download-outline" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No Downloads</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Download tracks to listen offline
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (downloads.length === 0) return null;

    return (
      <View style={[styles.headerInfo, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerCount, { color: theme.text }]}>
            {downloads.length} track{downloads.length !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.headerSize, { color: theme.textSecondary }]}>
            {formatFileSize(totalSize)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.deleteAllButton, { backgroundColor: theme.background }]}
          onPress={handleDeleteAll}
        >
          <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.deleteAllText, { color: theme.textSecondary }]}>Clear All</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 40, backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>Downloads</Text>
      </View>

      <FlatList
        data={downloads}
        keyExtractor={(item) => item.trackUrl}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        contentContainerStyle={[
          styles.listContent,
          downloads.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        // Performance optimizations
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={15}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  headerCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSize: {
    fontSize: 13,
    marginTop: 2,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  deleteAllText: {
    fontSize: 13,
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
  },
  item: {
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
});
