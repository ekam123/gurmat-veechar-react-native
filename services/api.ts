import { BASE_URL, AUDIO_BASE_URL } from '@/utils/constants';
import { CachedFolder, saveCachedItems } from './database';

/**
 * Fetch folder contents from the website API
 * Used as fallback when no local cache exists
 */
export async function fetchFolderContents(folderPath: string): Promise<CachedFolder[]> {
  const encodedPath = encodeURIComponent(folderPath);
  const url = `${BASE_URL}/audio.php?q=f&f=${encodedPath}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const items = parseHtmlResponse(html, folderPath);

    // Cache the fetched items in the database
    if (items.length > 0) {
      await saveCachedItems(items);
    }

    return items.map((item, index) => ({
      ...item,
      id: index + 1,
    }));
  } catch (error) {
    console.error('Error fetching folder contents:', error);
    return [];
  }
}

/**
 * Parse HTML response from gurmatveechar.com to extract folder and audio items
 */
function parseHtmlResponse(html: string, parentPath: string): Omit<CachedFolder, 'id'>[] {
  const items: Omit<CachedFolder, 'id'>[] = [];
  const now = Date.now();
  const seenPaths = new Set<string>();

  // Extract folder links - pattern: audio.php?q=f&f=%2F[encoded_path]
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

  // Extract audio file links - pattern: /audios/path/to/file.mp3
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
