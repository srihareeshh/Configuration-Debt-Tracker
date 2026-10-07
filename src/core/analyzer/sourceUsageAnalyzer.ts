/**
 * Configuration Debt Tracker - Source Usage Analyzer (Module 2)
 * Discovers and maps references from source code to configuration keys with 7-tier confidence metrics.
 * Directly implements SCM Configuration Audit.
 */

import * as fs from 'fs';
import { ReferenceResolver } from '../../code-intelligence/references/referenceResolver';
import { ConfigurationItem } from '../../models/configuration';
import { UsageAnalysis } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';

export interface AnalyzerProgressCallback {
  (current: number, total: number, currentKey: string): void;
}

export class SourceUsageAnalyzer {
  private referenceResolver: ReferenceResolver;

  constructor(referenceResolver: ReferenceResolver = new ReferenceResolver()) {
    this.referenceResolver = referenceResolver;
  }

  /**
   * Analyzes all configuration items against all source files in the workspace.
   */
  async analyzeUsage(
    items: ConfigurationItem[],
    allFiles: ScannedFileInfo[],
    onProgress?: AnalyzerProgressCallback
  ): Promise<Record<string, UsageAnalysis>> {
    const usageMap: Record<string, UsageAnalysis> = {};

    // 1. Identify source code files (strictly exclude pure config files, dotfiles, binaries, images)
    const sourceFiles = allFiles.filter((f) => {
      const name = f.filename.toLowerCase();
      const ext = f.extension.toLowerCase();

      // Exclude env files and docker files from source consumption analysis
      if (name === '.env' || name.startsWith('.env.') || name.endsWith('.env') || name === 'dockerfile') {
        return false;
      }

      // Exclude structured config formats
      const configExts = ['.yaml', '.yml', '.json', '.xml', '.toml', '.properties', '.ini'];
      if (configExts.includes(ext)) {
        return false;
      }

      // Exclude media, documents, lock files, and archives
      const nonSourceExts = [
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf',
        '.zip', '.tar', '.gz', '.lock', '.md', '.txt'
      ];
      if (nonSourceExts.includes(ext)) {
        return false;
      }

      // Source files should have a valid recognized extension or shebang script
      return ext.length > 0;
    });

    // 2. Pre-read source files in memory for fast scanning
    const fileContents = new Map<string, string>();
    for (const file of sourceFiles) {
      try {
        const content = await fs.promises.readFile(file.absolutePath, 'utf-8');
        fileContents.set(file.relativePath, content);
      } catch {
        // Skip unreadable files
      }
    }

    // 3. Extract unique configuration keys to avoid redundant work
    const uniqueKeys = Array.from(new Set(items.map((item) => item.key)));

    for (let i = 0; i < uniqueKeys.length; i++) {
      const key = uniqueKeys[i];
      if (onProgress) {
        onProgress(i + 1, uniqueKeys.length, key);
      }

      const analysis = this.referenceResolver.resolveKeyReferences(key, sourceFiles, fileContents);
      usageMap[key] = analysis;
    }

    return usageMap;
  }

  getReferenceResolver(): ReferenceResolver {
    return this.referenceResolver;
  }
}
