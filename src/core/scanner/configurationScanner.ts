/**
 * Configuration Debt Tracker - Configuration Scanner (Module 1)
 * Discovers, classifies, and inventories all configuration files in the workspace.
 * Directly implements SCM Configuration Identification.
 */

import * as fs from 'fs';
import { ConfigurationItem } from '../../models/configuration';
import { ParserRegistry } from '../../parsers/parserRegistry';
import { findFilesInDirectory, ScannedFileInfo } from '../../utils/fileUtils';

export interface ScannerProgressCallback {
  (current: number, total: number, currentFile: string): void;
}

export interface ScannerResult {
  items: ConfigurationItem[];
  scannedConfigFiles: ScannedFileInfo[];
  allScannedFiles: ScannedFileInfo[];
  errors: { file: string; message: string }[];
}

export class ConfigurationScanner {
  private parserRegistry: ParserRegistry;

  constructor(parserRegistry: ParserRegistry = new ParserRegistry()) {
    this.parserRegistry = parserRegistry;
  }

  /**
   * Scans the workspace directory, extracts configuration items, and reports progress.
   */
  async scanWorkspace(
    workspaceDir: string,
    excludePatterns: string[] = [],
    onProgress?: ScannerProgressCallback
  ): Promise<ScannerResult> {
    const errors: { file: string; message: string }[] = [];
    const items: ConfigurationItem[] = [];

    // 1. Discover all files
    const allFiles = await findFilesInDirectory(workspaceDir, workspaceDir, excludePatterns);

    // 2. Filter configuration files
    const configFiles = allFiles.filter((f) => this.parserRegistry.canParse(f));

    // 3. Parse each configuration file
    for (let i = 0; i < configFiles.length; i++) {
      const fileInfo = configFiles[i];
      if (onProgress) {
        onProgress(i + 1, configFiles.length, fileInfo.relativePath);
      }

      try {
        const content = await fs.promises.readFile(fileInfo.absolutePath, 'utf-8');
        const parsedItems = await this.parserRegistry.parse(fileInfo, content);
        items.push(...parsedItems);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({
          file: fileInfo.relativePath,
          message: `Failed to parse configuration: ${message}`
        });
      }
    }

    return {
      items,
      scannedConfigFiles: configFiles,
      allScannedFiles: allFiles,
      errors
    };
  }
}
