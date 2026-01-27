import { useState, useEffect, useCallback } from 'react';
import {
  getAllCachedItems,
  getTrack,
  getFavorites,
  isFavorite,
  CachedFolder,
  Track,
  Favorite,
} from '@/services/database';

/**
 * Hook to fetch folder contents
 */
export function useFolderContents(path: string) {
  const [items, setItems] = useState<CachedFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllCachedItems(path);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load folder'));
    } finally {
      setIsLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, isLoading, error, reload: load };
}

/**
 * Hook to fetch track info
 */
export function useTrackInfo(trackUrl: string) {
  const [track, setTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!trackUrl) {
      setTrack(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await getTrack(trackUrl);
      setTrack(data);
    } catch (e) {
      console.error('Error loading track:', e);
    } finally {
      setIsLoading(false);
    }
  }, [trackUrl]);

  useEffect(() => {
    load();
  }, [load]);

  return { track, isLoading, reload: load };
}

/**
 * Hook to fetch favorites
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFavorites();
      setFavorites(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load favorites'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { favorites, isLoading, error, reload: load };
}

/**
 * Hook to check if a folder is favorited
 */
export function useIsFavorite(folderPath: string) {
  const [favorited, setFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!folderPath) {
      setFavorited(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await isFavorite(folderPath);
      setFavorited(result);
    } catch (e) {
      console.error('Error checking favorite:', e);
    } finally {
      setIsLoading(false);
    }
  }, [folderPath]);

  useEffect(() => {
    load();
  }, [load]);

  return { favorited, isLoading, reload: load, setFavorited };
}
