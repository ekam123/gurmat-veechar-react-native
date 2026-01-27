import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, AUDIO_BASE_URL } from '@/utils/constants';
import { saveCachedItems, getLocalCachedItems, CachedFolder } from './database';

const SYNC_PREFIX = 'folderSync:';
const SYNC_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_SYNC_ENTRIES = 1000; // Maximum number of sync timestamps to keep
const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Cleanup every 7 days
const CLEANUP_KEY = 'folderSync:lastCleanup';

/**
 * Check if a folder needs syncing (more than 30 days since last sync)
 */
async function needsSync(folderPath: string): Promise<boolean> {
  try {
    const lastSync = await AsyncStorage.getItem(SYNC_PREFIX + folderPath);
    if (!lastSync) {
      return true; // Never synced
    }

    const lastSyncDate = parseInt(lastSync, 10);
    return Date.now() - lastSyncDate > SYNC_INTERVAL_MS;
  } catch {
    return false;
  }
}

/**
 * Mark a folder as synced
 */
async function markSynced(folderPath: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_PREFIX + folderPath, Date.now().toString());
    // Run cleanup periodically
    await cleanupOldSyncEntries();
  } catch (error) {
    console.error('Error marking folder synced:', error);
  }
}

/**
 * Clean up old sync entries to prevent unbounded AsyncStorage growth
 */
async function cleanupOldSyncEntries(): Promise<void> {
  try {
    // Check if cleanup is needed
    const lastCleanup = await AsyncStorage.getItem(CLEANUP_KEY);
    const now = Date.now();

    if (lastCleanup && now - parseInt(lastCleanup, 10) < CLEANUP_INTERVAL_MS) {
      return; // Cleanup was done recently
    }

    // Get all keys with sync prefix
    const allKeys = await AsyncStorage.getAllKeys();
    const syncKeys = allKeys.filter((key) => key.startsWith(SYNC_PREFIX) && key !== CLEANUP_KEY);

    if (syncKeys.length <= MAX_SYNC_ENTRIES) {
      await AsyncStorage.setItem(CLEANUP_KEY, now.toString());
      return; // Under limit, no cleanup needed
    }

    // Get all entries with their timestamps
    const entries: { key: string; timestamp: number }[] = [];
    const multiGet = await AsyncStorage.multiGet(syncKeys);

    for (const [key, value] of multiGet) {
      if (value) {
        entries.push({ key, timestamp: parseInt(value, 10) });
      }
    }

    // Sort by timestamp (oldest first) and remove oldest entries
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const keysToRemove = entries.slice(0, entries.length - MAX_SYNC_ENTRIES).map((e) => e.key);

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old sync entries`);
    }

    await AsyncStorage.setItem(CLEANUP_KEY, now.toString());
  } catch (error) {
    console.error('Error cleaning up sync entries:', error);
  }
}

/**
 * Sync a folder in background if needed (non-blocking)
 * Returns immediately, syncs in background
 *
 * @param folderPath - The folder path to sync
 * @param onNewItems - Optional callback when new items are found
 */
export function syncFolderIfNeeded(
  folderPath: string,
  onNewItems?: (items: CachedFolder[]) => void
): void {
  // Run async without blocking
  (async () => {
    try {
      const shouldSync = await needsSync(folderPath);
      if (!shouldSync) {
        return;
      }

      console.log(`Syncing folder: ${folderPath}`);

      // Fetch from API
      const apiItems = await fetchFolderFromApi(folderPath);
      if (apiItems.length === 0) {
        return;
      }

      // Get existing items
      const existingItems = await getLocalCachedItems(folderPath);
      const existingPaths = new Set(existingItems.map((item) => item.itemPath));

      // Find new items
      const newItems = apiItems.filter((item) => !existingPaths.has(item.itemPath));

      // Save new items to database
      if (newItems.length > 0) {
        await saveCachedItems(newItems);
        console.log(`Added ${newItems.length} new items to ${folderPath}`);

        // Notify caller of new items
        if (onNewItems) {
          const allItems = apiItems.map((item, index) => ({
            ...item,
            id: index + 1,
          }));
          onNewItems(allItems);
        }
      }

      // Mark as synced
      await markSynced(folderPath);
    } catch (error) {
      console.error(`Error syncing folder ${folderPath}:`, error);
    }
  })();
}

/**
 * Force sync a folder (for pull-to-refresh)
 * Returns the updated items
 */
export async function forceSyncFolder(folderPath: string): Promise<CachedFolder[]> {
  try {
    // Fetch from API
    const apiItems = await fetchFolderFromApi(folderPath);

    if (apiItems.length === 0) {
      // API returned nothing, return cached data
      return getLocalCachedItems(folderPath);
    }

    // Get existing items
    const existingItems = await getLocalCachedItems(folderPath);
    const existingPaths = new Set(existingItems.map((item) => item.itemPath));

    // Find and save new items
    const newItems = apiItems.filter((item) => !existingPaths.has(item.itemPath));
    if (newItems.length > 0) {
      await saveCachedItems(newItems);
      console.log(`Added ${newItems.length} new items to ${folderPath}`);
    }

    // Mark as synced
    await markSynced(folderPath);

    // Return full list with IDs
    return apiItems.map((item, index) => ({
      ...item,
      id: index + 1,
    }));
  } catch (error) {
    console.error(`Error force syncing folder ${folderPath}:`, error);
    // On error, return cached data
    return getLocalCachedItems(folderPath);
  }
}

/**
 * Fetch folder contents from API
 */
async function fetchFolderFromApi(folderPath: string): Promise<Omit<CachedFolder, 'id'>[]> {
  const encodedPath = encodeURIComponent(folderPath);
  const url = `${BASE_URL}/audio.php?q=f&f=${encodedPath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseHtmlResponse(html, folderPath);
}

/**
 * Parse HTML response to extract items
 */
function parseHtmlResponse(html: string, parentPath: string): Omit<CachedFolder, 'id'>[] {
  const items: Omit<CachedFolder, 'id'>[] = [];
  const now = Date.now();
  const seenPaths = new Set<string>();

  // Extract folder links
  const folderRegex = /audio\.php\?q=f&f=(%2F[^"'&\s<>]+)/gi;
  let match;

  while ((match = folderRegex.exec(html)) !== null) {
    const itemPath = decodeURIComponent(match[1]);

    if (itemPath === parentPath || parentPath.startsWith(itemPath + '/')) continue;
    if (!itemPath.startsWith(parentPath + '/')) continue;

    const relativePath = itemPath.substring(parentPath.length + 1);
    if (relativePath.includes('/')) continue;
    if (seenPaths.has(itemPath)) continue;
    seenPaths.add(itemPath);

    const rawName = itemPath.split('/').pop() || '';
    const displayName = rawName.replace(/_/g, ' ').replace(/^\d+\s*/, '').trim() || rawName;

    items.push({
      parentPath,
      itemName: displayName,
      itemPath,
      itemType: 'folder',
      sortOrder: items.length,
      lastUpdated: now,
    });
  }

  // Extract audio links
  const audioRegex = /href=["'](?:https?:\/\/[^/]+)?\/audios([^"']+\.mp3)["']/gi;

  while ((match = audioRegex.exec(html)) !== null) {
    const audioPath = decodeURIComponent(match[1]);
    const itemPath = `${AUDIO_BASE_URL}${audioPath}`;

    const audioParentPath = '/' + audioPath.substring(1, audioPath.lastIndexOf('/'));
    if (audioParentPath !== parentPath) continue;
    if (seenPaths.has(itemPath)) continue;
    seenPaths.add(itemPath);

    const fileName = audioPath.substring(audioPath.lastIndexOf('/') + 1);
    let displayName = fileName
      .replace(/\.mp3$/i, '')
      .replace(/\./g, ' ')
      .replace(/\s*--\s*/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();

    items.push({
      parentPath,
      itemName: displayName || fileName,
      itemPath,
      itemType: 'audio',
      sortOrder: items.length,
      lastUpdated: now,
    });
  }

  return items;
}
