/**
 * Configuration Debt Tracker - JSON Configuration Parser
 * Extracts nested keys, line numbers, and values from configuration JSON files.
 */

import { ConfigurationItem } from '../../models/configuration';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { detectSecret, maskValue } from '../../utils/secretDetector';
import { IConfigurationParser } from '../baseParser';

export class JsonParser implements IConfigurationParser {
  readonly id = 'json';
  readonly name = 'JSON Configuration Parser (.json)';

  canParse(fileInfo: ScannedFileInfo): boolean {
    return fileInfo.extension === '.json';
  }

  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    const items: ConfigurationItem[] = [];

    // Skip lockfiles or large non-config JSON files
    const filename = fileInfo.filename.toLowerCase();
    if (filename.includes('lock') || filename.includes('-lock.json')) {
      return items;
    }

    try {
      const parsed = JSON.parse(content);
      const lines = content.split(/\r?\n/);

      // Line finder for specific key segments
      const findKeyLine = (targetKeySegment: string, startFrom = 0): number => {
        const escaped = targetKeySegment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`"${escaped}"\\s*:`);
        for (let i = startFrom; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            return i + 1;
          }
        }
        return 1;
      };

      const traverse = (obj: unknown, prefix: string, parentLine: number) => {
        if (obj !== null && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            for (let idx = 0; idx < obj.length; idx++) {
              const val = obj[idx];
              const fullKey = `${prefix}[${idx}]`;
              if (typeof val === 'object' && val !== null) {
                traverse(val, fullKey, parentLine);
              } else {
                this.pushItem(items, fileInfo, fullKey, String(val ?? ''), parentLine);
              }
            }
          } else {
            const record = obj as Record<string, unknown>;
            for (const key of Object.keys(record)) {
              const fullKey = prefix ? `${prefix}.${key}` : key;
              const val = record[key];
              const line = findKeyLine(key, Math.max(0, parentLine - 1));

              if (typeof val === 'object' && val !== null) {
                traverse(val, fullKey, line);
              } else {
                this.pushItem(items, fileInfo, fullKey, String(val ?? ''), line);
              }
            }
          }
        }
      };

      traverse(parsed, '', 1);
    } catch {
      // Gracefully handle invalid or malformed JSON
    }

    return items;
  }

  private pushItem(
    items: ConfigurationItem[],
    fileInfo: ScannedFileInfo,
    key: string,
    value: string,
    line: number
  ): void {
    const secretCheck = detectSecret(key, value);
    const masked = maskValue(value, secretCheck.isSecret);

    items.push({
      id: `${fileInfo.relativePath}:${line}:${key}`,
      key,
      value: secretCheck.isSecret ? masked : value,
      maskedValue: masked,
      filePath: fileInfo.relativePath,
      absoluteFilePath: fileInfo.absolutePath,
      line,
      format: 'json',
      type: 'json-property',
      sensitivity: secretCheck.sensitivity,
      lastModified: fileInfo.mtime,
      ageDays: fileInfo.ageDays,
      isPotentialSecret: secretCheck.isSecret,
      secretType: secretCheck.secretType
    });
  }
}
