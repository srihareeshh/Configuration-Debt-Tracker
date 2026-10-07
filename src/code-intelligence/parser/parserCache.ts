/**
 * Configuration Debt Tracker - Parser & AST Cache
 * In-memory token and structure cache indexed by file path and content hash/mtime.
 */

export interface CachedFileAnalysis<T = any> {
  filePath: string;
  mtimeMs: number;
  contentHash: string;
  data: T;
}

export class ParserCache {
  private cache = new Map<string, CachedFileAnalysis>();

  get<T>(filePath: string, mtimeMs: number): T | null {
    const entry = this.cache.get(filePath);
    if (!entry) return null;
    if (entry.mtimeMs !== mtimeMs) {
      this.cache.delete(filePath);
      return null;
    }
    return entry.data as T;
  }

  set<T>(filePath: string, mtimeMs: number, contentHash: string, data: T): void {
    this.cache.set(filePath, {
      filePath,
      mtimeMs,
      contentHash,
      data
    });
  }

  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
