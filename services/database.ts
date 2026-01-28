import * as SQLite from 'expo-sqlite';
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
} from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

export interface CachedFolder {
  id: number;
  parentPath: string;
  itemName: string;
  itemPath: string;
  itemType: 'folder' | 'audio';
  sortOrder: number;
  lastUpdated: number;
}

export interface Track {
  id: number;
  trackUrl: string;
  trackName: string;
  trackDuration: number;
  trackSizeBytes: number;
  currentPlaybackTime: number;
  isDownloaded: boolean;
  localFilePath: string | null;
  lastPlayedDate: number | null;
  downloadDate: number | null;
  isCompleted: boolean;
}

export interface Favorite {
  id: number;
  folderPath: string;
  folderName: string;
  dateAdded: number;
}

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database
 * Copies the seed database from assets if needed, then opens it
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  const dbName = 'gurmatveechar.db';
  const dbPath = `${documentDirectory}SQLite/${dbName}`;

  // Ensure SQLite directory exists
  const dirInfo = await getInfoAsync(`${documentDirectory}SQLite`);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(`${documentDirectory}SQLite`, {
      intermediates: true,
    });
  }

  // Check if database already exists
  const dbInfo = await getInfoAsync(dbPath);
  if (!dbInfo.exists) {
    // Copy seed database from bundled assets
    // The seed database should be included in the app bundle
    try {
      const asset = Asset.fromModule(require('../assets/seed.db'));
      await asset.downloadAsync();
      if (asset.localUri) {
        await copyAsync({
          from: asset.localUri,
          to: dbPath,
        });
      }
    } catch (error) {
      console.log('Seed database not found, creating new database');
    }
  }

  // Open the database
  db = await SQLite.openDatabaseAsync(dbName);

  // Create tables if they don't exist (for fresh installs without seed)
  await createTables(db);

  return db;
}

/**
 * Create database tables
 */
async function createTables(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_path TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_path TEXT NOT NULL,
      item_type TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      last_updated INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_url TEXT UNIQUE NOT NULL,
      track_name TEXT NOT NULL,
      track_duration REAL DEFAULT 0,
      track_size_bytes INTEGER DEFAULT 0,
      current_playback_time REAL DEFAULT 0,
      is_downloaded INTEGER DEFAULT 0,
      local_file_path TEXT,
      last_played_date INTEGER,
      download_date INTEGER,
      is_completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_path TEXT UNIQUE NOT NULL,
      folder_name TEXT NOT NULL,
      date_added INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cached_folders_parent ON cached_folders(parent_path);
    CREATE INDEX IF NOT EXISTS idx_cached_folders_name ON cached_folders(item_name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cached_folders_path ON cached_folders(item_path);
    CREATE INDEX IF NOT EXISTS idx_tracks_url ON tracks(track_url);
  `);
}

/**
 * Get database instance (must call initDatabase first)
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============ Cached Folders ============

/**
 * Get cached items for a parent path from Core Data seed
 */
export async function getCachedItemsFromSeed(parentPath: string): Promise<CachedFolder[]> {
  const database = getDatabase();

  // Query from Core Data format (Z-prefixed tables)
  const rows = await database.getAllAsync<{
    Z_PK: number;
    ZPARENTPATH: string;
    ZITEMNAME: string;
    ZITEMPATH: string;
    ZITEMTYPE: string;
    ZSORTORDER: number;
    ZLASTUPDATED: number;
  }>(
    `SELECT Z_PK, ZPARENTPATH, ZITEMNAME, ZITEMPATH, ZITEMTYPE, ZSORTORDER, ZLASTUPDATED
     FROM ZCACHEDFOLDERRECORD
     WHERE ZPARENTPATH = ?
     ORDER BY ZSORTORDER ASC, ZITEMNAME ASC`,
    [parentPath]
  );

  return rows.map((row) => ({
    id: row.Z_PK,
    parentPath: row.ZPARENTPATH,
    itemName: row.ZITEMNAME,
    itemPath: row.ZITEMPATH,
    itemType: row.ZITEMTYPE as 'folder' | 'audio',
    sortOrder: row.ZSORTORDER,
    lastUpdated: row.ZLASTUPDATED * 1000, // Convert Core Data timestamp to JS
  }));
}

/**
 * Get cached items from new schema (for items added after seed)
 */
export async function getCachedItems(parentPath: string): Promise<CachedFolder[]> {
  const database = getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    parent_path: string;
    item_name: string;
    item_path: string;
    item_type: string;
    sort_order: number;
    last_updated: number;
  }>(
    `SELECT * FROM cached_folders WHERE parent_path = ? ORDER BY sort_order ASC, item_name ASC`,
    [parentPath]
  );

  return rows.map((row) => ({
    id: row.id,
    parentPath: row.parent_path,
    itemName: row.item_name,
    itemPath: row.item_path,
    itemType: row.item_type as 'folder' | 'audio',
    sortOrder: row.sort_order,
    lastUpdated: row.last_updated,
  }));
}

/**
 * Get cached items from local database only (seed + cached_folders)
 * Does NOT fall back to API - use this when you need to check local state
 */
export async function getLocalCachedItems(parentPath: string): Promise<CachedFolder[]> {
  // Try seed data first
  const seedItems = await getCachedItemsFromSeed(parentPath);
  if (seedItems.length > 0) {
    return seedItems;
  }

  // Try locally cached data
  return getCachedItems(parentPath);
}

/**
 * Get all cached items for a parent path (seed + new + API fallback)
 */
export async function getAllCachedItems(parentPath: string): Promise<CachedFolder[]> {
  // Try local data first
  const localItems = await getLocalCachedItems(parentPath);
  if (localItems.length > 0) {
    return localItems;
  }

  // Fall back to API fetch if no local data
  const { fetchFolderContents } = await import('./api');
  return fetchFolderContents(parentPath);
}

/**
 * Save cached items to database
 */
export async function saveCachedItems(items: Omit<CachedFolder, 'id'>[]): Promise<void> {
  const database = getDatabase();

  for (const item of items) {
    await database.runAsync(
      `INSERT OR IGNORE INTO cached_folders (parent_path, item_name, item_path, item_type, sort_order, last_updated)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.parentPath, item.itemName, item.itemPath, item.itemType, item.sortOrder, item.lastUpdated]
    );
  }
}

/**
 * Search cached folders by name
 */
export async function searchCachedItems(query: string): Promise<CachedFolder[]> {
  const database = getDatabase();
  const searchPattern = `%${query}%`;

  // Search in Core Data seed
  const seedRows = await database.getAllAsync<{
    Z_PK: number;
    ZPARENTPATH: string;
    ZITEMNAME: string;
    ZITEMPATH: string;
    ZITEMTYPE: string;
    ZSORTORDER: number;
    ZLASTUPDATED: number;
  }>(
    `SELECT Z_PK, ZPARENTPATH, ZITEMNAME, ZITEMPATH, ZITEMTYPE, ZSORTORDER, ZLASTUPDATED
     FROM ZCACHEDFOLDERRECORD
     WHERE ZITEMNAME LIKE ?
     ORDER BY ZITEMNAME ASC
     LIMIT 100`,
    [searchPattern]
  );

  return seedRows.map((row) => ({
    id: row.Z_PK,
    parentPath: row.ZPARENTPATH,
    itemName: row.ZITEMNAME,
    itemPath: row.ZITEMPATH,
    itemType: row.ZITEMTYPE as 'folder' | 'audio',
    sortOrder: row.ZSORTORDER,
    lastUpdated: row.ZLASTUPDATED * 1000,
  }));
}

// ============ Tracks ============

/**
 * Get track by URL
 */
export async function getTrack(trackUrl: string): Promise<Track | null> {
  const database = getDatabase();

  const row = await database.getFirstAsync<{
    id: number;
    track_url: string;
    track_name: string;
    track_duration: number;
    track_size_bytes: number;
    current_playback_time: number;
    is_downloaded: number;
    local_file_path: string | null;
    last_played_date: number | null;
    download_date: number | null;
    is_completed: number;
  }>(`SELECT * FROM tracks WHERE track_url = ?`, [trackUrl]);

  if (!row) return null;

  return {
    id: row.id,
    trackUrl: row.track_url,
    trackName: row.track_name,
    trackDuration: row.track_duration,
    trackSizeBytes: row.track_size_bytes,
    currentPlaybackTime: row.current_playback_time,
    isDownloaded: row.is_downloaded === 1,
    localFilePath: row.local_file_path,
    lastPlayedDate: row.last_played_date,
    downloadDate: row.download_date,
    isCompleted: row.is_completed === 1,
  };
}

/**
 * Create or update track
 */
export async function upsertTrack(track: Partial<Track> & { trackUrl: string; trackName: string }): Promise<void> {
  const database = getDatabase();

  await database.runAsync(
    `INSERT INTO tracks (track_url, track_name, track_duration, track_size_bytes, current_playback_time, is_downloaded, local_file_path, last_played_date, download_date, is_completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(track_url) DO UPDATE SET
       track_name = excluded.track_name,
       track_duration = COALESCE(excluded.track_duration, track_duration),
       track_size_bytes = COALESCE(excluded.track_size_bytes, track_size_bytes),
       current_playback_time = COALESCE(excluded.current_playback_time, current_playback_time),
       is_downloaded = COALESCE(excluded.is_downloaded, is_downloaded),
       local_file_path = COALESCE(excluded.local_file_path, local_file_path),
       last_played_date = COALESCE(excluded.last_played_date, last_played_date),
       download_date = COALESCE(excluded.download_date, download_date),
       is_completed = COALESCE(excluded.is_completed, is_completed)`,
    [
      track.trackUrl,
      track.trackName,
      track.trackDuration ?? 0,
      track.trackSizeBytes ?? 0,
      track.currentPlaybackTime ?? 0,
      track.isDownloaded ? 1 : 0,
      track.localFilePath ?? null,
      track.lastPlayedDate ?? null,
      track.downloadDate ?? null,
      track.isCompleted ? 1 : 0,
    ]
  );
}

/**
 * Update track playback position
 */
export async function updateTrackPosition(trackUrl: string, position: number, isCompleted: boolean): Promise<void> {
  const database = getDatabase();

  await database.runAsync(
    `UPDATE tracks SET current_playback_time = ?, is_completed = ?, last_played_date = ? WHERE track_url = ?`,
    [position, isCompleted ? 1 : 0, Date.now(), trackUrl]
  );
}

/**
 * Mark a track as completed or not completed
 */
export async function markTrackCompleted(trackUrl: string, isCompleted: boolean): Promise<void> {
  const database = getDatabase();

  // First ensure the track exists
  await upsertTrack({ trackUrl, trackName: trackUrl.split('/').pop() || 'Unknown' });

  await database.runAsync(
    `UPDATE tracks SET is_completed = ?, current_playback_time = CASE WHEN ? = 1 THEN 0 ELSE current_playback_time END WHERE track_url = ?`,
    [isCompleted ? 1 : 0, isCompleted ? 1 : 0, trackUrl]
  );
}

/**
 * Get all downloaded tracks with optional pagination
 */
export async function getDownloadedTracks(limit: number = 500, offset: number = 0): Promise<Track[]> {
  const database = getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    track_url: string;
    track_name: string;
    track_duration: number;
    track_size_bytes: number;
    current_playback_time: number;
    is_downloaded: number;
    local_file_path: string | null;
    last_played_date: number | null;
    download_date: number | null;
    is_completed: number;
  }>(`SELECT * FROM tracks WHERE is_downloaded = 1 ORDER BY download_date DESC LIMIT ? OFFSET ?`, [limit, offset]);

  return rows.map((row) => ({
    id: row.id,
    trackUrl: row.track_url,
    trackName: row.track_name,
    trackDuration: row.track_duration,
    trackSizeBytes: row.track_size_bytes,
    currentPlaybackTime: row.current_playback_time,
    isDownloaded: true,
    localFilePath: row.local_file_path,
    lastPlayedDate: row.last_played_date,
    downloadDate: row.download_date,
    isCompleted: row.is_completed === 1,
  }));
}

/**
 * Get the total count of downloaded tracks
 */
export async function getDownloadedTracksCount(): Promise<number> {
  const database = getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM tracks WHERE is_downloaded = 1`
  );
  return result?.count ?? 0;
}

/**
 * Mark track as downloaded
 */
export async function markTrackDownloaded(
  trackUrl: string,
  localFilePath: string,
  sizeBytes: number
): Promise<void> {
  const database = getDatabase();

  await database.runAsync(
    `UPDATE tracks SET is_downloaded = 1, local_file_path = ?, track_size_bytes = ?, download_date = ? WHERE track_url = ?`,
    [localFilePath, sizeBytes, Date.now(), trackUrl]
  );
}

/**
 * Delete downloaded track
 */
export async function deleteDownloadedTrack(trackUrl: string): Promise<void> {
  const database = getDatabase();

  await database.runAsync(
    `UPDATE tracks SET is_downloaded = 0, local_file_path = NULL WHERE track_url = ?`,
    [trackUrl]
  );
}

// ============ Favorites ============

/**
 * Get all favorites
 */
export async function getFavorites(): Promise<Favorite[]> {
  const database = getDatabase();

  // Check Core Data seed first
  try {
    const seedRows = await database.getAllAsync<{
      Z_PK: number;
      ZFOLDERPATH: string;
      ZFOLDERNAME: string;
      ZDATEADDED: number;
    }>(`SELECT Z_PK, ZFOLDERPATH, ZFOLDERNAME, ZDATEADDED FROM ZFAVORITEFOLDERRECORD ORDER BY ZDATEADDED DESC`);

    if (seedRows.length > 0) {
      return seedRows.map((row) => ({
        id: row.Z_PK,
        folderPath: row.ZFOLDERPATH,
        folderName: row.ZFOLDERNAME,
        dateAdded: row.ZDATEADDED * 1000,
      }));
    }
  } catch {
    // Table might not exist
  }

  // Fall back to new schema
  const rows = await database.getAllAsync<{
    id: number;
    folder_path: string;
    folder_name: string;
    date_added: number;
  }>(`SELECT * FROM favorites ORDER BY date_added DESC`);

  return rows.map((row) => ({
    id: row.id,
    folderPath: row.folder_path,
    folderName: row.folder_name,
    dateAdded: row.date_added,
  }));
}

/**
 * Add favorite
 */
export async function addFavorite(folderPath: string, folderName: string): Promise<void> {
  const database = getDatabase();

  await database.runAsync(
    `INSERT OR IGNORE INTO favorites (folder_path, folder_name, date_added) VALUES (?, ?, ?)`,
    [folderPath, folderName, Date.now()]
  );
}

/**
 * Remove favorite
 */
export async function removeFavorite(folderPath: string): Promise<void> {
  const database = getDatabase();

  await database.runAsync(`DELETE FROM favorites WHERE folder_path = ?`, [folderPath]);
}

/**
 * Check if folder is favorited
 */
export async function isFavorite(folderPath: string): Promise<boolean> {
  const database = getDatabase();

  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM favorites WHERE folder_path = ?`,
    [folderPath]
  );

  return (row?.count ?? 0) > 0;
}
