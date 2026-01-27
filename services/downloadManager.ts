import {
  createDownloadResumable,
  getInfoAsync,
  deleteAsync,
  makeDirectoryAsync,
  documentDirectory,
} from 'expo-file-system/legacy';
import { useDownloadStore } from '@/stores/downloadStore';
import * as database from '@/services/database';

const DOWNLOADS_DIR_PATH = `${documentDirectory}downloads/`;

/**
 * Ensure downloads directory exists
 */
async function ensureDownloadsDir(): Promise<void> {
  const dirInfo = await getInfoAsync(DOWNLOADS_DIR_PATH);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(DOWNLOADS_DIR_PATH, { intermediates: true });
  }
}

/**
 * Generate local file path for a track
 */
function getLocalFilePath(trackUrl: string): string {
  // Extract filename from URL or generate from hash
  const urlParts = trackUrl.split('/');
  const filename = urlParts[urlParts.length - 1] || `${Date.now()}.mp3`;
  const decodedFilename = decodeURIComponent(filename);
  return `${DOWNLOADS_DIR_PATH}${decodedFilename}`;
}

/**
 * Download a track
 */
export async function downloadTrack(trackUrl: string, trackName: string): Promise<void> {
  const store = useDownloadStore.getState();

  // Check if already downloading
  if (trackUrl in store.activeDownloads) {
    return;
  }

  try {
    await ensureDownloadsDir();

    store.startDownload(trackUrl, trackName);

    const localPath = getLocalFilePath(trackUrl);

    // Create download resumable with progress callback
    const downloadResumable = createDownloadResumable(
      trackUrl,
      localPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
            : 0;

        store.updateProgress(trackUrl, {
          progress,
          downloadedBytes: downloadProgress.totalBytesWritten,
          totalBytes: downloadProgress.totalBytesExpectedToWrite,
        });
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (result) {
      // Get file size
      const fileInfo = await getInfoAsync(localPath);
      const sizeBytes = fileInfo.exists && 'size' in fileInfo ? fileInfo.size || 0 : 0;

      // Update database
      await database.upsertTrack({
        trackUrl,
        trackName,
        isDownloaded: true,
        localFilePath: localPath,
        trackSizeBytes: sizeBytes,
        downloadDate: Date.now(),
      });

      await database.markTrackDownloaded(trackUrl, localPath, sizeBytes);

      store.completeDownload(trackUrl);
    }
  } catch (error) {
    console.error('Download error:', error);
    store.setError(error instanceof Error ? error.message : 'Download failed');
    store.cancelDownload(trackUrl);
  }
}

/**
 * Delete a downloaded track
 */
export async function deleteDownload(trackUrl: string): Promise<void> {
  try {
    const track = await database.getTrack(trackUrl);

    if (track?.localFilePath) {
      const fileInfo = await getInfoAsync(track.localFilePath);
      if (fileInfo.exists) {
        await deleteAsync(track.localFilePath);
      }
    }

    await database.deleteDownloadedTrack(trackUrl);
  } catch (error) {
    console.error('Delete download error:', error);
  }
}

/**
 * Get total size of all downloads
 */
export async function getTotalDownloadsSize(): Promise<number> {
  const tracks = await database.getDownloadedTracks();
  return tracks.reduce((total, track) => total + (track.trackSizeBytes || 0), 0);
}

/**
 * Delete all downloads
 */
export async function deleteAllDownloads(): Promise<void> {
  const tracks = await database.getDownloadedTracks();

  for (const track of tracks) {
    await deleteDownload(track.trackUrl);
  }

  // Also clear the downloads directory
  try {
    const dirInfo = await getInfoAsync(DOWNLOADS_DIR_PATH);
    if (dirInfo.exists) {
      await deleteAsync(DOWNLOADS_DIR_PATH, { idempotent: true });
    }
  } catch (error) {
    console.error('Error clearing downloads directory:', error);
  }
}

/**
 * Check if a track is downloaded
 */
export async function isTrackDownloaded(trackUrl: string): Promise<boolean> {
  const track = await database.getTrack(trackUrl);
  if (!track?.isDownloaded || !track.localFilePath) {
    return false;
  }

  // Verify file still exists
  const fileInfo = await getInfoAsync(track.localFilePath);
  if (!fileInfo.exists) {
    // File was deleted, update database
    await database.deleteDownloadedTrack(trackUrl);
    return false;
  }

  return true;
}
