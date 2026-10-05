/**
 * Configuration Debt Tracker - Environment Variables (.env) Parser
 * Extracts environment variables, comments, documentation, and line numbers.
 */

import { ConfigurationItem } from '../../models/configuration';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { detectSecret, maskValue } from '../../utils/secretDetector';
import { IConfigurationParser } from '../baseParser';

export class EnvParser implements IConfigurationParser {
  readonly id = 'env';
  readonly name = 'Environment Variables Parser (.env)';

  canParse(fileInfo: ScannedFileInfo): boolean {
    const filename = fileInfo.filename.toLowerCase();
    return (
      filename === '.env' ||
      filename.startsWith('.env.') ||
      filename.endsWith('.env')
    );
  }

  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    const items: ConfigurationItem[] = [];
    const lines = content.split(/\r?\n/);
    let pendingDocLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (trimmed === '') {
        pendingDocLines = [];
        continue;
      }

      if (trimmed.startsWith('#')) {
        // Collect comment for the next item
        const commentText = trimmed.replace(/^#+\s*/, '').trim();
        if (commentText.length > 0) {
          pendingDocLines.push(commentText);
        }
        continue;
      }

      // Check for KEY=VALUE or export KEY=VALUE
      const lineWithoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
      const eqIndex = lineWithoutExport.indexOf('=');

      if (eqIndex > 0) {
        const rawKey = lineWithoutExport.slice(0, eqIndex).trim();
        let rawVal = lineWithoutExport.slice(eqIndex + 1).trim();

        // Check if there is an inline comment
        // Only strip if not inside quotes
        if (!rawVal.startsWith('"') && !rawVal.startsWith("'")) {
          const hashIndex = rawVal.indexOf('#');
          if (hashIndex >= 0) {
            const inlineComment = rawVal.slice(hashIndex + 1).trim();
            if (inlineComment) {
              pendingDocLines.push(inlineComment);
            }
            rawVal = rawVal.slice(0, hashIndex).trim();
          }
        } else {
          // Remove wrapping quotes if paired
          if (
            (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
            (rawVal.startsWith("'") && rawVal.endsWith("'"))
          ) {
            rawVal = rawVal.slice(1, -1);
          }
        }

        // Validate key format (standard environment variable key)
        if (/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(rawKey)) {
          const secretCheck = detectSecret(rawKey, rawVal);
          const masked = maskValue(rawVal, secretCheck.isSecret);
          const documentation = pendingDocLines.length > 0 ? pendingDocLines.join(' | ') : undefined;

          items.push({
            id: `${fileInfo.relativePath}:${lineNumber}:${rawKey}`,
            key: rawKey,
            value: secretCheck.isSecret ? masked : rawVal,
            maskedValue: masked,
            filePath: fileInfo.relativePath,
            absoluteFilePath: fileInfo.absolutePath,
            line: lineNumber,
            format: 'env',
            type: 'env-var',
            sensitivity: secretCheck.sensitivity,
            documentation,
            lastModified: fileInfo.mtime,
            ageDays: fileInfo.ageDays,
            isPotentialSecret: secretCheck.isSecret,
            secretType: secretCheck.secretType
          });
        }
      }

      pendingDocLines = [];
    }

    return items;
  }
}
