/**
 * Configuration Debt Tracker - Java AST Analyzer
 * Supports .java.
 * Recognizes System.getenv(), System.getProperty(), @Value("${KEY}"), @ConfigProperty, and normalized variants.
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class JavaAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'java';
  readonly extensions = ['.java'];

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];

    // 1. Direct Catalog Patterns (Level 3)
    const catalogRefs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'java');
    references.push(...catalogRefs);

    // 2. Normalized Variants (Level 4: e.g. database.url <-> DATABASE_URL)
    const normRefs = this.matchNormalizedVariants(key, indexedFile, fileInfo, 'java');
    references.push(...normRefs);

    return references;
  }
}
