/**
 * Configuration Debt Tracker - XML Configuration Parser
 * Extracts properties, entries, and settings from XML files (pom.xml, web.xml, etc.)
 */

import { XMLParser as FXMLParser } from 'fast-xml-parser';
import { ConfigurationItem } from '../../models/configuration';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { detectSecret, maskValue } from '../../utils/secretDetector';
import { IConfigurationParser } from '../baseParser';

export class XmlParser implements IConfigurationParser {
  readonly id = 'xml';
  readonly name = 'XML Configuration Parser (.xml)';

  canParse(fileInfo: ScannedFileInfo): boolean {
    return fileInfo.extension === '.xml';
  }

  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    const items: ConfigurationItem[] = [];
    const lines = content.split(/\r?\n/);

    const findTagLine = (tagName: string, startFrom = 0): number => {
      const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`<${escaped}[\\s>]`, 'i');
      for (let i = startFrom; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          return i + 1;
        }
      }
      return 1;
    };

    try {
      const xml = new FXMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      });
      const parsed = xml.parse(content);

      const traverse = (obj: unknown, prefix: string, parentLine: number) => {
        if (obj !== null && typeof obj === 'object') {
          const record = obj as Record<string, unknown>;
          for (const key of Object.keys(record)) {
            if (key.startsWith('@_')) {
              // XML attribute
              const attrName = key.slice(2);
              const fullKey = prefix ? `${prefix}.${attrName}` : attrName;
              const val = String(record[key] ?? '');
              this.pushItem(items, fileInfo, fullKey, val, parentLine);
            } else {
              const fullKey = prefix ? `${prefix}.${key}` : key;
              const val = record[key];
              const line = findTagLine(key, Math.max(0, parentLine - 1));

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
      // Gracefully handle malformed XML
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
      format: 'xml',
      type: 'xml-tag',
      sensitivity: secretCheck.sensitivity,
      lastModified: fileInfo.mtime,
      ageDays: fileInfo.ageDays,
      isPotentialSecret: secretCheck.isSecret,
      secretType: secretCheck.secretType
    });
  }
}
