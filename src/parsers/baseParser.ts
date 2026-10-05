/**
 * Configuration Debt Tracker - Base Configuration Parser Interface
 * Pluggable architecture for format-specific configuration adapters.
 */

import { ConfigurationItem } from '../models/configuration';
import { ScannedFileInfo } from '../utils/fileUtils';

export interface IConfigurationParser {
  readonly id: string;
  readonly name: string;

  /**
   * Returns true if this parser can handle the specified file
   */
  canParse(fileInfo: ScannedFileInfo): boolean;

  /**
   * Parses the file content and extracts individual configuration items
   */
  parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]>;
}
