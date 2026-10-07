/**
 * Configuration Debt Tracker - Properties & INI Configuration Parser
 * Handles Java/Spring .properties, .ini, .cfg, and gradle.properties.
 * Extracts key-value mappings, comments, sections, line numbers, and masks secrets.
 */

import { ConfigurationItem } from '../../models/configuration';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { detectSecret, maskValue } from '../../utils/secretDetector';
import { IConfigurationParser } from '../baseParser';

export class PropertiesParser implements IConfigurationParser {
  readonly id = 'properties';
  readonly name = 'Properties & INI Parser';

  canParse(fileInfo: ScannedFileInfo): boolean {
    const ext = fileInfo.extension.toLowerCase();
    const filename = fileInfo.filename.toLowerCase();
    return (
      ext === '.properties' ||
      ext === '.ini' ||
      ext === '.cfg' ||
      filename === 'gradle.properties' ||
      filename.includes('application.properties')
    );
  }

  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    const items: ConfigurationItem[] = [];
    const lines = content.split(/\r?\n/);

    let currentSection = '';
    let pendingDocLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') {
        pendingDocLines = [];
        continue;
      }

      // Comment line (# or !)
      if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
        const comment = trimmed.replace(/^[#!]+\s*/, '').trim();
        if (comment.length > 0) {
          pendingDocLines.push(comment);
        }
        continue;
      }

      // Section header in INI: [section]
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        pendingDocLines = [];
        continue;
      }

      // Properties delimiter can be '=' or ':'
      let delimIndex = trimmed.indexOf('=');
      const colonIndex = trimmed.indexOf(':');
      if (delimIndex < 0 || (colonIndex >= 0 && colonIndex < delimIndex)) {
        delimIndex = colonIndex;
      }

      if (delimIndex > 0) {
        const rawKey = trimmed.slice(0, delimIndex).trim();
        let rawVal = trimmed.slice(delimIndex + 1).trim();

        // Strip inline comments if present
        if (!rawVal.startsWith('"') && !rawVal.startsWith("'")) {
          const hashIdx = rawVal.indexOf('#');
          if (hashIdx >= 0) {
            rawVal = rawVal.slice(0, hashIdx).trim();
          }
        }

        // Unquote string values
        let cleanVal = rawVal;
        if (
          (cleanVal.startsWith('"') && cleanVal.endsWith('"')) ||
          (cleanVal.startsWith("'") && cleanVal.endsWith("'"))
        ) {
          cleanVal = cleanVal.slice(1, -1);
        }

        const fullKey = currentSection ? `${currentSection}.${rawKey}` : rawKey;
        const secretResult = detectSecret(fullKey, cleanVal);
        const documentation = pendingDocLines.length > 0 ? pendingDocLines.join(' ') : undefined;

        items.push({
          id: `${fileInfo.relativePath}:${lineNumber}:${fullKey}`,
          key: fullKey,
          value: cleanVal,
          maskedValue: maskValue(cleanVal, secretResult.isSecret),
          filePath: fileInfo.relativePath,
          absoluteFilePath: fileInfo.absolutePath,
          line: lineNumber,
          format: 'properties',
          type: 'properties-entry',
          sensitivity: secretResult.sensitivity,
          documentation,
          isPotentialSecret: secretResult.isSecret,
          secretType: secretResult.secretType
        });

        pendingDocLines = [];
      }
    }

    return items;
  }
}
