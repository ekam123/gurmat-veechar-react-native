/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size in bytes to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Format date to relative string (e.g., "2 days ago")
 */
export function formatRelativeDate(timestamp: number): string {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return new Date(timestamp).toLocaleDateString();
  }
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} min ago`;
  }
  return 'Just now';
}

/**
 * Format track name by removing file extension and cleaning up
 */
export function formatTrackName(name: string): string {
  if (!name) return '';

  // Remove .mp3 extension
  let formatted = name.replace(/\.mp3$/i, '');

  // Replace dots and dashes with spaces
  formatted = formatted.replace(/\./g, ' ').replace(/--/g, ' - ');

  // Remove leading numbers like "001 - " or "01--"
  formatted = formatted.replace(/^\d+\s*[-–]\s*/, '');

  return formatted.trim();
}

/**
 * Extract folder display name from path
 */
export function getFolderDisplayName(path: string): string {
  if (!path) return '';

  const parts = path.split('/').filter(Boolean);
  const name = parts[parts.length - 1] || '';

  // Replace underscores with spaces
  return name.replace(/_/g, ' ');
}

/**
 * Decode URL-encoded path for display
 */
export function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
