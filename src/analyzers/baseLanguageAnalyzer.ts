/**
 * Configuration Debt Tracker - Base Language Analyzer Interface
 * Deterministic source code reference finder for configuration keys.
 */

import { UsageReference } from '../models/usage';
import { ScannedFileInfo } from '../utils/fileUtils';

export interface ILanguageAnalyzer {
  readonly language: string;

  /**
   * Returns true if this analyzer handles the given source file
   */
  canAnalyze(fileInfo: ScannedFileInfo): boolean;

  /**
   * Searches the source file content for references to the given configuration key
   */
  findReferences(
    key: string,
    content: string,
    fileInfo: ScannedFileInfo
  ): UsageReference[];
}
