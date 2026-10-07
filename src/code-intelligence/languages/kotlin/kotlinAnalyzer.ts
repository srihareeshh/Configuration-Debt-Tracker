/**
 * Configuration Debt Tracker - Kotlin AST Analyzer
 * Supports .kt, .kts. Recognizes System.getenv("KEY"), System.getProperty("KEY").
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class KotlinAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'kotlin';
  readonly extensions = ['.kt', '.kts'];

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const refs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'kotlin');
    if (refs.length === 0) {
      refs.push(...this.matchNormalizedVariants(key, indexedFile, fileInfo, 'kotlin'));
    }
    return refs;
  }
}
