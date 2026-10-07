/**
 * Configuration Debt Tracker - Go AST Analyzer
 * Supports .go. Recognizes os.Getenv("KEY"), os.LookupEnv("KEY").
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class GoAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'go';
  readonly extensions = ['.go'];

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const refs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'go');
    if (refs.length === 0) {
      refs.push(...this.matchNormalizedVariants(key, indexedFile, fileInfo, 'go'));
    }
    return refs;
  }
}
