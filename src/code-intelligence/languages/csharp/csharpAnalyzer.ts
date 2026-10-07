/**
 * Configuration Debt Tracker - C# AST Analyzer
 * Supports .cs. Recognizes Environment.GetEnvironmentVariable("KEY"), configuration["KEY"], config.GetSection().
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class CSharpAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'csharp';
  readonly extensions = ['.cs'];

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const refs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'csharp');
    if (refs.length === 0) {
      refs.push(...this.matchNormalizedVariants(key, indexedFile, fileInfo, 'csharp'));
    }
    return refs;
  }
}
