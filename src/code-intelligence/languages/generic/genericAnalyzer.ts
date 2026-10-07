/**
 * Configuration Debt Tracker - Generic Structural Fallback Analyzer (Level 7)
 * Provides contextual word-boundary matching within code lines (ignoring comments)
 * when specialized language analyzers do not match.
 * Always marks confidence as 50-60% (Uncertain Usage).
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { escapeRegex } from '../../references/configAccessPatterns';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class GenericAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'generic';
  readonly extensions = [
    '.html', '.htm', '.vue', '.svelte', '.sql', '.lua', '.dart', '.swift', '.scala'
  ];

  override canAnalyze(_fileInfo: ScannedFileInfo): boolean {
    return true; // Fallback handles any source file
  }

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];
    const pattern = new RegExp(`\\b${escapeRegex(key)}\\b`, 'g');

    for (const line of indexedFile.lines) {
      if (line.isPureComment) continue;

      // Only search code portion
      const code = line.codeOnlyText;
      const trimmed = code.trim();

      // Suppress documentation string literals or example variables
      if (
        /['"][^'"]*(?:required|example|documentation|describe|notice|info)[^'"]*['"]/i.test(trimmed) ||
        /(?:example|sample|dummy|demo)\s*=\s*['"][^'"]*['"]/i.test(trimmed)
      ) {
        continue;
      }

      let match: RegExpExecArray | null;

      pattern.lastIndex = 0;
      while ((match = pattern.exec(code)) !== null) {
        const col = match.index + 1;
        const enclosing = indexedFile.symbols.find(
          (s) => line.lineNumber >= s.startLine && line.lineNumber <= s.endLine
        );

        references.push({
          filePath: fileInfo.relativePath,
          absoluteFilePath: fileInfo.absolutePath,
          line: line.lineNumber,
          column: col,
          snippet: line.originalText.trim(),
          language: 'generic',
          usageType: 'generic',
          confidence: 55,
          confidenceLevel: 7,
          patternMatched: `Generic word boundary match: '${key}'`,
          enclosingSymbol: enclosing,
          isTestFile: indexedFile.isTestFile
        });
      }
    }

    return references;
  }
}
