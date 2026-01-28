import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore } from '@/stores/audioStore';
import { getDownloadedTracks, getDownloadedTracksGrouped, Track, GroupedDownloads } from '@/services/database';
import { deleteDownload, getTotalDownloadsSize, deleteAllDownloads } from '@/services/downloadManager';
import { playTrack } from '@/services/audioPlayer';
import { formatFileSize } from '@/utils/formatters';
import DownloadTrackItem from '@/components/DownloadTrackItem';
import DownloadFolderSection from '@/components/DownloadFolderSection';

type ViewMode = 'grouped' | 'flat';

export default function DownloadsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [downloads, setDownloads] = useState<Track[]>([]);
  const [groupedDownloads, setGroupedDownloads] = useState<GroupedDownloads[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [totalSize, setTotalSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadDownloads = async () => {
    try {
      const [flatData, groupedData, size] = await Promise.all([
        getDownloadedTracks(),
        getDownloadedTracksGrouped(),
        getTotalDownloadsSize(),
      ]);
      setDownloads(flatData);
      setGroupedDownloads(groupedData);
      setTotalSize(size);
      // Reset expanded folders on load
      setExpandedFolders(new Set());
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

  // Memoize the flat queue for flat view
  const flatQueue = useMemo(() => {
    return downloads.map((d) => ({
      trackUrl: d.trackUrl,
      trackName: d.trackName,
      folderPath: 'Downloads',
      folderName: 'Downloads',
    }));
  }, [downloads]);

  // Build queue from a folder group
  const buildFolderQueue = useCallback((group: GroupedDownloads) => {
    return group.tracks.map((t) => ({
      trackUrl: t.trackUrl,
      trackName: t.trackName,
      folderPath: t.folderPath ?? 'Downloads',
      folderName: t.folderName ?? 'Downloads',
    }));
  }, []);

  // Play track in flat view (queue is entire downloads list)
  const handlePlayFlat = async (track: Track) => {
    const index = downloads.findIndex((d) => d.trackUrl === track.trackUrl);
    useAudioStore.getState().setQueue(flatQueue, index);

    await playTrack({
      trackUrl: track.trackUrl,
      trackName: track.trackName,
      folderPath: 'Downloads',
      folderName: 'Downloads',
    });
  };

  // Play track in grouped view (queue is folder's tracks)
  const handlePlayGroupedTrack = async (track: Track, group: GroupedDownloads) => {
    const queue = buildFolderQueue(group);
    const index = group.tracks.findIndex((t) => t.trackUrl === track.trackUrl);
    useAudioStore.getState().setQueue(queue, index >= 0 ? index : 0);

    await playTrack({
      trackUrl: track.trackUrl,
      trackName: track.trackName,
      folderPath: track.folderPath ?? 'Downloads',
      folderName: track.folderName ?? 'Downloads',
    });
  };

  // Play all tracks in a folder
  const handlePlayFolder = async (group: GroupedDownloads) => {
    if (group.tracks.length === 0) return;

    const queue = buildFolderQueue(group);
    useAudioStore.getState().setQueue(queue, 0);

    const firstTrack = group.tracks[0];
    await playTrack({
      trackUrl: firstTrack.trackUrl,
      trackName: firstTrack.trackName,
      folderPath: firstTrack.folderPath ?? 'Downloads',
      folderName: firstTrack.folderName ?? 'Downloads',
    });
  };

  const handleDelete = (track: Track) => {
    Alert.alert(
      'Delete Download',
      `Delete "${track.trackName}"? This will remove the downloaded file.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDownload(track.trackUrl);
            // Update flat list
            setDownloads((prev) => prev.filter((d) => d.trackUrl !== track.trackUrl));
            // Update grouped list
            setGroupedDownloads((prev) =>
              prev
                .map((group) => ({
                  ...group,
                  tracks: group.tracks.filter((t) => t.trackUrl !== track.trackUrl),
                  trackCount: group.tracks.filter((t) => t.trackUrl !== track.trackUrl).length,
                  totalSize: group.tracks
                    .filter((t) => t.trackUrl !== track.trackUrl)
                    .reduce((sum, t) => sum + (t.trackSizeBytes || 0), 0),
                }))
                .filter((group) => group.tracks.length > 0)
            );
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
            setGroupedDownloads([]);
            setTotalSize(0);
          },
        },
      ]
    );
  };

  const toggleFolderExpand = (folderPath: string | null) => {
    const key = folderPath ?? '__ungrouped__';
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isFolderExpanded = (folderPath: string | null) => {
    const key = folderPath ?? '__ungrouped__';
    return expandedFolders.has(key);
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'grouped' ? 'flat' : 'grouped'));
  };

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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.viewToggleButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={toggleViewMode}
          >
            <Ionicons
              name={viewMode === 'grouped' ? 'folder-outline' : 'list-outline'}
              size={16}
              color={theme.text}
            />
            <Text style={[styles.viewToggleText, { color: theme.text }]}>
              {viewMode === 'grouped' ? 'By Folder' : 'By Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteAllButton, { backgroundColor: theme.background }]}
            onPress={handleDeleteAll}
          >
            <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.deleteAllText, { color: theme.textSecondary }]}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderGroupedView = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.listContent,
        groupedDownloads.length === 0 && styles.emptyList,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {renderHeader()}
      {groupedDownloads.length === 0 && !isLoading ? (
        renderEmpty()
      ) : (
        groupedDownloads.map((group) => (
          <DownloadFolderSection
            key={group.folderPath ?? '__ungrouped__'}
            group={group}
            isExpanded={isFolderExpanded(group.folderPath)}
            onToggleExpand={() => toggleFolderExpand(group.folderPath)}
            onPlayFolder={() => handlePlayFolder(group)}
            onPlayTrack={(track) => handlePlayGroupedTrack(track, group)}
            onDeleteTrack={handleDelete}
          />
        ))
      )}
    </ScrollView>
  );

  const renderFlatView = () => (
    <FlatList
      data={downloads}
      keyExtractor={(item) => item.trackUrl}
      renderItem={({ item }) => (
        <DownloadTrackItem
          track={item}
          onPress={() => handlePlayFlat(item)}
          onDelete={() => handleDelete(item)}
        />
      )}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={!isLoading ? renderEmpty : null}
      contentContainerStyle={[
        styles.listContent,
        downloads.length === 0 && styles.emptyList,
      ]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={15}
      updateCellsBatchingPeriod={50}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 40, backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>Downloads</Text>
      </View>

      {viewMode === 'grouped' ? renderGroupedView() : renderFlatView()}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
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
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
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
