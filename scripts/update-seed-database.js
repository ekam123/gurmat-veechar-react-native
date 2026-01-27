#!/usr/bin/env node

/**
 * Script to update the seed database with all folders and tracks from gurmatveechar.com
 * This crawls the entire website structure and populates the ZCACHEDFOLDERRECORD table
 */

const https = require('https');
const http = require('http');
const sqlite3 = require('better-sqlite3');
const path = require('path');

// Configuration
const BASE_URL = 'https://gurmatveechar.com';
const AUDIO_BASE_URL = 'https://gurmatveechar.com/audios';
const SEED_DB_PATH = path.join(__dirname, '..', 'assets', 'seed.db');
const DELAY_MS = 300; // Delay between requests to be respectful to the server

// Root paths to crawl
const ROOT_PATHS = [
  '/Katha',
  '/Keertan',
  '/Gurbani_Santhya',
  '/Gurbani_Ucharan'
];

// Statistics
let stats = {
  foldersFound: 0,
  tracksFound: 0,
  foldersInserted: 0,
  tracksInserted: 0,
  errors: 0,
  skipped: 0
};

// Track visited paths to avoid duplicates
const visitedPaths = new Set();

/**
 * Fetch URL content with retry logic
 */
function fetchUrl(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'GurmatVeechar-App-Seeder/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 30000
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        fetchUrl(response.headers.location, retries).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    });

    request.on('error', (err) => {
      if (retries > 0) {
        console.log(`  Retrying ${url} (${retries} attempts left)`);
        setTimeout(() => {
          fetchUrl(url, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    });

    request.on('timeout', () => {
      request.destroy();
      if (retries > 0) {
        console.log(`  Timeout, retrying ${url} (${retries} attempts left)`);
        setTimeout(() => {
          fetchUrl(url, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error(`Timeout for ${url}`));
      }
    });
  });
}

/**
 * Parse HTML to extract folders and audio files
 */
function parseHtml(html, parentPath) {
  const items = { folders: [], audios: [] };
  const seenPaths = new Set();

  // Extract folder links - pattern: audio.php?q=f&f=%2F[encoded_path]
  const folderRegex = /audio\.php\?q=f&f=(%2F[^"'&\s<>]+)/gi;
  let match;

  while ((match = folderRegex.exec(html)) !== null) {
    const itemPath = decodeURIComponent(match[1]);

    // Skip if this is the parent path or a parent of the current path (breadcrumb)
    if (itemPath === parentPath || parentPath.startsWith(itemPath + '/')) {
      continue;
    }

    // Only include direct children
    if (!itemPath.startsWith(parentPath + '/')) {
      continue;
    }

    // Check if it's a direct child (no additional slashes after parent)
    const relativePath = itemPath.substring(parentPath.length + 1);
    if (relativePath.includes('/')) {
      continue;
    }

    // Avoid duplicates
    if (seenPaths.has(itemPath)) {
      continue;
    }
    seenPaths.add(itemPath);

    // Extract display name from path
    const rawName = itemPath.split('/').pop();
    const displayName = formatFolderName(rawName);

    items.folders.push({
      parentPath,
      itemName: displayName,
      itemPath,
      itemType: 'folder'
    });
  }

  // Extract audio file links - pattern: /audios/path/to/file.mp3
  const audioRegex = /href=["'](?:https?:\/\/[^/]+)?\/audios([^"']+\.mp3)["']/gi;

  while ((match = audioRegex.exec(html)) !== null) {
    const audioPath = decodeURIComponent(match[1]);
    const itemPath = `${AUDIO_BASE_URL}${audioPath}`;

    // Check that it's a direct child of the parent folder
    const audioParentPath = '/' + audioPath.substring(1, audioPath.lastIndexOf('/'));
    if (audioParentPath !== parentPath) {
      continue;
    }

    // Avoid duplicates
    if (seenPaths.has(itemPath)) {
      continue;
    }
    seenPaths.add(itemPath);

    // Extract display name from filename
    const fileName = audioPath.substring(audioPath.lastIndexOf('/') + 1);
    const displayName = formatAudioName(fileName);

    items.audios.push({
      parentPath,
      itemName: displayName,
      itemPath,
      itemType: 'audio'
    });
  }

  return items;
}

/**
 * Format folder name for display
 */
function formatFolderName(name) {
  let displayName = name.replace(/_/g, ' ');
  // Keep numeric prefixes for folders as they indicate order
  return displayName.trim() || name;
}

/**
 * Format audio filename for display
 */
function formatAudioName(fileName) {
  let displayName = fileName.replace(/\.mp3$/i, '');
  displayName = displayName.replace(/\./g, ' ');
  displayName = displayName.replace(/\s*--\s*/g, ' - ');
  displayName = displayName.replace(/\s+/g, ' ');
  return displayName.trim() || fileName;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Recursively crawl a folder and all subfolders
 */
async function crawlFolder(db, folderPath, depth = 0) {
  const indent = '  '.repeat(depth);

  if (visitedPaths.has(folderPath)) {
    return;
  }
  visitedPaths.add(folderPath);

  const encodedPath = encodeURIComponent(folderPath);
  const url = `${BASE_URL}/audio.php?q=f&f=${encodedPath}`;

  console.log(`${indent}Crawling: ${folderPath}`);

  try {
    const html = await fetchUrl(url);
    const items = parseHtml(html, folderPath);

    console.log(`${indent}  Found: ${items.folders.length} folders, ${items.audios.length} tracks`);

    stats.foldersFound += items.folders.length;
    stats.tracksFound += items.audios.length;

    // Insert folders
    for (let i = 0; i < items.folders.length; i++) {
      const folder = items.folders[i];
      insertItem(db, folder, i);
    }

    // Insert audio tracks
    for (let i = 0; i < items.audios.length; i++) {
      const audio = items.audios[i];
      insertItem(db, audio, items.folders.length + i);
    }

    // Recursively crawl subfolders
    for (const folder of items.folders) {
      await sleep(DELAY_MS);
      await crawlFolder(db, folder.itemPath, depth + 1);
    }

  } catch (error) {
    console.error(`${indent}  ERROR: ${error.message}`);
    stats.errors++;
  }
}

/**
 * Insert item into database
 */
function insertItem(db, item, sortOrder) {
  try {
    // Check if item already exists
    const existing = db.prepare(
      'SELECT Z_PK FROM ZCACHEDFOLDERRECORD WHERE ZITEMPATH = ?'
    ).get(item.itemPath);

    if (existing) {
      stats.skipped++;
      return;
    }

    // Get the next Z_PK
    const maxPk = db.prepare('SELECT MAX(Z_PK) as maxPk FROM ZCACHEDFOLDERRECORD').get();
    const nextPk = (maxPk?.maxPk || 0) + 1;

    // Insert the item
    const now = Date.now() / 1000 - 978307200; // Convert to Core Data timestamp (seconds since 2001-01-01)

    db.prepare(`
      INSERT INTO ZCACHEDFOLDERRECORD (Z_PK, Z_ENT, Z_OPT, ZSORTORDER, ZLASTUPDATED, ZITEMNAME, ZITEMPATH, ZITEMTYPE, ZPARENTPATH)
      VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?)
    `).run(nextPk, sortOrder, now, item.itemName, item.itemPath, item.itemType, item.parentPath);

    if (item.itemType === 'folder') {
      stats.foldersInserted++;
    } else {
      stats.tracksInserted++;
    }

  } catch (error) {
    console.error(`  Failed to insert ${item.itemPath}: ${error.message}`);
    stats.errors++;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Gurmat Veechar Seed Database Updater');
  console.log('='.repeat(60));
  console.log(`Database: ${SEED_DB_PATH}`);
  console.log(`Delay between requests: ${DELAY_MS}ms`);
  console.log('');

  // Open database
  let db;
  try {
    db = sqlite3(SEED_DB_PATH);
    console.log('Database opened successfully');

    // Get current counts
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM ZCACHEDFOLDERRECORD').get();
    console.log(`Current items in database: ${currentCount.count}`);
    console.log('');
  } catch (error) {
    console.error(`Failed to open database: ${error.message}`);
    process.exit(1);
  }

  // Start crawling from root paths
  const startTime = Date.now();

  for (const rootPath of ROOT_PATHS) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Starting root: ${rootPath}`);
    console.log('='.repeat(40));

    // First, ensure the root folder exists
    const rootExists = db.prepare(
      'SELECT Z_PK FROM ZCACHEDFOLDERRECORD WHERE ZITEMPATH = ?'
    ).get(rootPath);

    if (!rootExists) {
      const rootName = rootPath.substring(1).replace(/_/g, ' ');
      insertItem(db, {
        parentPath: '/',
        itemName: rootName,
        itemPath: rootPath,
        itemType: 'folder'
      }, 0);
    }

    await crawlFolder(db, rootPath, 0);
  }

  // Close database
  db.close();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Duration: ${duration} seconds`);
  console.log(`Folders found: ${stats.foldersFound}`);
  console.log(`Tracks found: ${stats.tracksFound}`);
  console.log(`Folders inserted: ${stats.foldersInserted}`);
  console.log(`Tracks inserted: ${stats.tracksInserted}`);
  console.log(`Skipped (already exist): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('='.repeat(60));
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
