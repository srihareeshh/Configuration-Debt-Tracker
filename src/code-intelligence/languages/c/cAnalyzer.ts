/**
 * Configuration Debt Tracker - C & C++ AST Analyzer
 * Supports .c, .cpp, .cc, .cxx, .h, .hpp. Recognizes getenv("KEY").
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class CAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'c';
  readonly extensions = ['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp'];

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const refs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'c');
    if (refs.length === 0) {
      refs.push(...this.matchNormalizedVariants(key, indexedFile, fileInfo, 'c'));
    }
    return refs;
  }
}
