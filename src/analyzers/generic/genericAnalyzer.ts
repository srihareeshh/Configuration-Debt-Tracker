/**
 * Configuration Debt Tracker - Generic / Fallback Source Usage Analyzer
 * Handles normalized key variations and fallback searches for any source file.
 */

import { SupportedSourceLanguage, UsageReference } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { ILanguageAnalyzer } from '../baseLanguageAnalyzer';

export class GenericAnalyzer implements ILanguageAnalyzer {
  readonly language: SupportedSourceLanguage = 'generic';

  canAnalyze(fileInfo: ScannedFileInfo): boolean {
    const ext = fileInfo.extension;
    // Common source and script extensions
    return [
      '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
      '.go', '.rs', '.rb', '.php', '.cs', '.cpp', '.c',
      '.html', '.vue', '.svelte'
    ].includes(ext);
  }

  findReferences(
    key: string,
    content: string,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];
    const lines = content.split(/\r?\n/);
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Literal key match
    const literalPattern = new RegExp(`\\b${escapedKey}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      if (literalPattern.test(line)) {
        references.push({
          filePath: fileInfo.relativePath,
          absoluteFilePath: fileInfo.absolutePath,
          line: lineNum,
          column: 1,
          snippet: line.trim(),
          language: 'generic',
          usageType: 'dynamic',
          confidence: 65,
          patternMatched: `Word boundary: ${key}`
        });
      }
    }

    return references;
  }
}

/**
 * Generates alternative key representations (e.g. DATABASE_URL <-> database.url <-> databaseUrl)
 */
export function getKeyVariants(key: string): string[] {
  const variants = new Set<string>();

  // If SNAKE_CASE or UPPER_CASE: DATABASE_URL -> database.url, databaseUrl, database_url
  if (key.includes('_')) {
    const lowerSnake = key.toLowerCase();
    variants.add(lowerSnake);
    variants.add(lowerSnake.replace(/_/g, '.'));
    variants.add(lowerSnake.replace(/_/g, '-'));

    // camelCase
    const parts = lowerSnake.split('_');
    const camel = parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    variants.add(camel);
  }

  // If dot notation: database.url -> DATABASE_URL, database_url, databaseUrl
  if (key.includes('.')) {
    const parts = key.split('.');
    const upperSnake = parts.map((p) => p.toUpperCase()).join('_');
    const lowerSnake = parts.map((p) => p.toLowerCase()).join('_');
    variants.add(upperSnake);
    variants.add(lowerSnake);

    const camel = parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    variants.add(camel);
  }

  // Remove self
  variants.delete(key);
  return Array.from(variants);
}
