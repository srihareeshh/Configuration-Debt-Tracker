/**
 * Configuration Debt Tracker - Base Language Analyzer
 * Common foundational analyzer base for all language-specific AST analyzers.
 */

import { SupportedSourceLanguage, UsageReference } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { IndexedSourceFile } from '../ast/astIndexer';
import { CONFIG_ACCESS_PATTERNS } from '../references/configAccessPatterns';
import { generatePossibleVariants } from '../references/normalizedKeyResolver';

export interface ILanguageAnalyzerV2 {
  readonly languageId: SupportedSourceLanguage;
  readonly extensions: string[];

  canAnalyze(fileInfo: ScannedFileInfo): boolean;

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[];
}

export abstract class AbstractLanguageAnalyzer implements ILanguageAnalyzerV2 {
  abstract readonly languageId: SupportedSourceLanguage;
  abstract readonly extensions: string[];

  canAnalyze(fileInfo: ScannedFileInfo): boolean {
    const ext = fileInfo.extension.toLowerCase();
    return this.extensions.includes(ext);
  }

  abstract findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[];

  /**
   * Helper that checks standard catalog access patterns for this language
   */
  protected matchCatalogPatterns(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo,
    langFilter: string
  ): UsageReference[] {
    const refs: UsageReference[] = [];
    const patterns = CONFIG_ACCESS_PATTERNS.filter((p) => p.language === langFilter);

    for (const patternDef of patterns) {
      const regex = patternDef.buildRegex(key);

      for (const line of indexedFile.lines) {
        if (line.isPureComment) continue;

        // Strictly search ONLY within codeOnlyText to reject matches in comments
        const code = line.codeOnlyText;
        let match: RegExpExecArray | null;

        // Reset regex state
        regex.lastIndex = 0;
        while ((match = regex.exec(code)) !== null) {
          const col = match.index + 1;
          const enclosing = indexedFile.symbols.find(
            (s) => line.lineNumber >= s.startLine && line.lineNumber <= s.endLine
          );

          refs.push({
            filePath: fileInfo.relativePath,
            absoluteFilePath: fileInfo.absolutePath,
            line: line.lineNumber,
            column: col,
            snippet: line.originalText.trim(),
            language: this.languageId,
            usageType: 'exact',
            confidence: patternDef.confidence,
            confidenceLevel: patternDef.confidenceLevel,
            patternMatched: `${patternDef.description}: ${match[0]}`,
            enclosingSymbol: enclosing,
            isTestFile: indexedFile.isTestFile
          });
        }
      }
    }

    return refs;
  }

  /**
   * Helper that checks normalized variants (Level 4)
   */
  protected matchNormalizedVariants(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo,
    langFilter: string
  ): UsageReference[] {
    const refs: UsageReference[] = [];
    const variants = generatePossibleVariants(key).filter((v) => v !== key);

    for (const variant of variants) {
      const varRefs = this.matchCatalogPatterns(variant, indexedFile, fileInfo, langFilter);
      for (const r of varRefs) {
        refs.push({
          ...r,
          usageType: 'normalized',
          confidence: Math.round(r.confidence * 0.85),
          confidenceLevel: 4,
          patternMatched: `Normalized variant '${variant}'`
        });
      }
    }

    return refs;
  }
}
