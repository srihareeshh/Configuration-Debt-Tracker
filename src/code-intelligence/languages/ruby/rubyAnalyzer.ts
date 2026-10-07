/**
 * Configuration Debt Tracker - Ruby AST Analyzer
 * Supports .rb. Recognizes ENV["KEY"], ENV.fetch("KEY").
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class RubyAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'ruby';
  readonly extensions = ['.rb'];

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const refs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'ruby');
    if (refs.length === 0) {
      refs.push(...this.matchNormalizedVariants(key, indexedFile, fileInfo, 'ruby'));
    }
    return refs;
  }
}
