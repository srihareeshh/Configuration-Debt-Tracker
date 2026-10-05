/**
 * Configuration Debt Tracker - File and Directory Utilities
 * Cross-platform, fast recursive workspace scanner with safety exclusions.
 */

import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  'coverage',
  '.nyc_output',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  '.idea',
  '.vscode',
  '.next',
  '.nuxt',
  'bin',
  'obj'
]);

export interface ScannedFileInfo {
  absolutePath: string;
  relativePath: string;
  filename: string;
  extension: string;
  mtime: Date;
  ageDays: number;
}

/**
 * Normalizes file paths to use forward slashes for consistent cross-platform display and matching
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Calculates age in days from a file modification date
 */
export function getAgeInDays(date: Date): number {
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Recursively scans a workspace directory and returns all non-excluded files with file metadata.
 */
export async function findFilesInDirectory(
  dir: string,
  baseDir: string = dir,
  customExcludes: string[] = []
): Promise<ScannedFileInfo[]> {
  const results: ScannedFileInfo[] = [];
  const excludeRegexes = customExcludes.map((pattern) => {
    // Basic glob pattern to regex conversion
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(escaped, 'i');
  });

  async function walk(currentDir: string): Promise<void> {
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      // Permission denied or unreadable directory, gracefully skip
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = normalizePath(path.relative(baseDir, fullPath));

      if (entry.isDirectory()) {
        if (DEFAULT_EXCLUDE_DIR_NAMES.has(entry.name.toLowerCase())) {
          continue;
        }
        if (excludeRegexes.some((re) => re.test(relativePath))) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (excludeRegexes.some((re) => re.test(relativePath))) {
          continue;
        }
        try {
          const stat = await fs.promises.stat(fullPath);
          const ageDays = getAgeInDays(stat.mtime);
          results.push({
            absolutePath: fullPath,
            relativePath,
            filename: entry.name,
            extension: path.extname(entry.name).toLowerCase(),
            mtime: stat.mtime,
            ageDays
          });
        } catch {
          // File might have been deleted concurrently, continue
        }
      }
    }
  }

  await walk(dir);
  return results;
}
