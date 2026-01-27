import { useState, useEffect, useCallback } from 'react';
import { useDownloadStore, DownloadProgress } from '@/stores/downloadStore';
import { getDownloadedTracks, Track } from '@/services/database';
import {
  downloadTrack,
  deleteDownload,
  getTotalDownloadsSize,
  isTrackDownloaded,
} from '@/services/downloadManager';

/**
 * Hook to manage downloads
 */
export function useDownloads() {
  const [downloads, setDownloads] = useState<Track[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const { activeDownloads, downloadQueue, status, error } = useDownloadStore();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const tracks = await getDownloadedTracks();
      setDownloads(tracks);
      const size = await getTotalDownloadsSize();
      setTotalSize(size);
    } catch (e) {
      console.error('Error loading downloads:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const download = useCallback(async (trackUrl: string, trackName: string) => {
    await downloadTrack(trackUrl, trackName);
    await load();
  }, [load]);

  const remove = useCallback(async (trackUrl: string) => {
    await deleteDownload(trackUrl);
    await load();
  }, [load]);

  const checkDownloaded = useCallback(async (trackUrl: string): Promise<boolean> => {
    return isTrackDownloaded(trackUrl);
  }, []);

  const getProgress = useCallback((trackUrl: string): DownloadProgress | undefined => {
    return activeDownloads[trackUrl];
  }, [activeDownloads]);

  return {
    // State
    downloads,
    totalSize,
    isLoading,
    activeDownloads,
    downloadQueue,
    status,
    error,

    // Actions
    download,
    remove,
    checkDownloaded,
    getProgress,
    reload: load,
  };
}

/**
 * Hook to check if a specific track is downloaded
 */
export function useIsDownloaded(trackUrl: string) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const check = useCallback(async () => {
    if (!trackUrl) {
      setIsDownloaded(false);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    try {
      const result = await isTrackDownloaded(trackUrl);
      setIsDownloaded(result);
    } catch (e) {
      console.error('Error checking download status:', e);
    } finally {
      setIsChecking(false);
    }
  }, [trackUrl]);

  useEffect(() => {
    check();
  }, [check]);

  return { isDownloaded, isChecking, recheck: check };
}
