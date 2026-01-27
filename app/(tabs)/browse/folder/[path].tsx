import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ViewToken,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAudioStore, buildQueueFromFolder } from '@/stores/audioStore';
import {
  getAllCachedItems,
  CachedFolder,
  getTrack,
  Track,
  addFavorite,
  removeFavorite,
  isFavorite,
} from '@/services/database';
import { syncFolderIfNeeded, forceSyncFolder } from '@/services/folderSync';
import { playTrack } from '@/services/audioPlayer';
import { downloadTrack } from '@/services/downloadManager';
import FolderItem from '@/components/FolderItem';
import AudioItem from '@/components/AudioItem';
import { getFolderDisplayName } from '@/utils/formatters';

export default function FolderScreen() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const [items, setItems] = useState<CachedFolder[]>([]);
  const [trackInfoMap, setTrackInfoMap] = useState<Map<string, Track>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // Track which items are currently visible for lazy loading
  const visibleItemsRef = useRef<Set<string>>(new Set());
  const loadingItemsRef = useRef<Set<string>>(new Set());

  const decodedPath = decodeURIComponent(path || '');
  const folderName = getFolderDisplayName(decodedPath);

  // Lazy load track info only for visible items
  const loadTrackInfoForItems = useCallback(async (itemPaths: string[]) => {
    const pathsToLoad = itemPaths.filter(
      (path) => !trackInfoMap.has(path) && !loadingItemsRef.current.has(path)
    );

    if (pathsToLoad.length === 0) return;

    // Mark as loading
    pathsToLoad.forEach((path) => loadingItemsRef.current.add(path));

    // Load in batches of 10 to avoid overwhelming the database
    const BATCH_SIZE = 10;
    for (let i = 0; i < pathsToLoad.length; i += BATCH_SIZE) {
      const batch = pathsToLoad.slice(i, i + BATCH_SIZE);
      const trackInfoPromises = batch.map(async (itemPath) => {
        const track = await getTrack(itemPath);
        return { url: itemPath, track };
      });

      const trackInfoResults = await Promise.all(trackInfoPromises);

      setTrackInfoMap((prev) => {
        const newMap = new Map(prev);
        trackInfoResults.forEach(({ url, track }) => {
          if (track) {
            newMap.set(url, track);
          }
          loadingItemsRef.current.delete(url);
        });
        return newMap;
      });
    }
  }, [trackInfoMap]);

  // Handle viewable items change for lazy loading
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const audioItemPaths = viewableItems
        .filter((item) => item.item?.itemType === 'audio')
        .map((item) => item.item.itemPath);

      visibleItemsRef.current = new Set(audioItemPaths);

      if (audioItemPaths.length > 0) {
        loadTrackInfoForItems(audioItemPaths);
      }
    },
    [loadTrackInfoForItems]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }).current;

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);

    try {
      // Load from local cache first (fast)
      const data = await getAllCachedItems(decodedPath);
      setItems(data);

      // Clear track info map for fresh load
      setTrackInfoMap(new Map());
      loadingItemsRef.current.clear();

      // Check favorite status
      const favorited = await isFavorite(decodedPath);
      setIsFavorited(favorited);

      // Check if folder needs syncing in background (if > 30 days old)
      // This runs without blocking - updates UI if new items found
      syncFolderIfNeeded(decodedPath, (newItems) => {
        setItems(newItems);
        // Track info will be lazy loaded when items become visible
      });
    } catch (error) {
      console.error('Error loading folder:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [decodedPath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    // Force sync from API and update UI when done
    forceSyncFolder(decodedPath)
      .then((freshData) => {
        if (freshData.length > 0) {
          setItems(freshData);
          // Clear track info map - will be lazy loaded when items become visible
          setTrackInfoMap(new Map());
          loadingItemsRef.current.clear();
        }
      })
      .catch((error) => {
        console.error('Error refreshing from API:', error);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [decodedPath]);

  const handleFolderPress = (item: CachedFolder) => {
    router.push(`/browse/folder/${encodeURIComponent(item.itemPath)}` as any);
  };

  const handleAudioPress = async (item: CachedFolder, index: number) => {
    // Build queue from all audio items in this folder
    const queue = buildQueueFromFolder(items, decodedPath, folderName);
    const audioIndex = items
      .filter((i) => i.itemType === 'audio')
      .findIndex((i) => i.itemPath === item.itemPath);

    useAudioStore.getState().setQueue(queue, audioIndex >= 0 ? audioIndex : 0);

    await playTrack({
      trackUrl: item.itemPath,
      trackName: item.itemName,
      folderPath: decodedPath,
      folderName: folderName,
    });
  };

  const handleDownload = async (item: CachedFolder) => {
    Alert.alert(
      'Download Track',
      `Download "${getFolderDisplayName(item.itemName)}" for offline playback?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              await downloadTrack(item.itemPath, item.itemName);
              // Refresh to show updated download status
              loadData(false);
            } catch (error) {
              Alert.alert('Download Failed', 'Unable to download track. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async () => {
    if (isFavorited) {
      await removeFavorite(decodedPath);
      setIsFavorited(false);
    } else {
      await addFavorite(decodedPath, folderName);
      setIsFavorited(true);
    }
  };

  const handlePlayAll = async () => {
    const audioItems = items.filter((item) => item.itemType === 'audio');
    if (audioItems.length === 0) return;

    const queue = buildQueueFromFolder(items, decodedPath, folderName);
    useAudioStore.getState().setQueue(queue, 0);

    await playTrack({
      trackUrl: audioItems[0].itemPath,
      trackName: audioItems[0].itemName,
      folderPath: decodedPath,
      folderName: folderName,
    });
  };

  const renderItem = ({ item, index }: { item: CachedFolder; index: number }) => {
    if (item.itemType === 'folder') {
      return <FolderItem item={item} onPress={() => handleFolderPress(item)} />;
    }

    return (
      <AudioItem
        item={item}
        trackInfo={trackInfoMap.get(item.itemPath)}
        onPress={() => handleAudioPress(item, index)}
        onDownload={() => handleDownload(item)}
      />
    );
  };

  const renderHeader = () => {
    const audioCount = items.filter((item) => item.itemType === 'audio').length;
    const folderCount = items.filter((item) => item.itemType === 'folder').length;

    if (items.length === 0) return null;

    return (
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerInfo}>
          {folderCount > 0 && (
            <Text style={[styles.headerCount, { color: theme.textSecondary }]}>
              {folderCount} folder{folderCount !== 1 ? 's' : ''}
            </Text>
          )}
          {audioCount > 0 && (
            <Text style={[styles.headerCount, { color: theme.textSecondary }]}>
              {folderCount > 0 ? ' · ' : ''}{audioCount} track{audioCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {audioCount > 0 && (
          <TouchableOpacity
            style={[styles.playAllButton, { backgroundColor: theme.primary }]}
            onPress={handlePlayAll}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={styles.playAllText}>Play All</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="folder-open-outline" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Empty Folder</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        No content available in this folder
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: folderName,
          headerRight: () => (
            <TouchableOpacity onPress={handleToggleFavorite} style={styles.favoriteButton}>
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorited ? theme.secondary : theme.text}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          // Performance optimizations
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={15}
          updateCellsBatchingPeriod={50}
          // Lazy loading for track info
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flexDirection: 'row',
  },
  headerCount: {
    fontSize: 13,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  playAllText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  favoriteButton: {
    padding: 4,
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
