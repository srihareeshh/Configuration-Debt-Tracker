/**
 * Configuration Debt Tracker - JavaScript & TypeScript AST Analyzer
 * Supports JS, TS, TSX, JSX, MJS, CJS.
 * Recognizes process.env, import.meta.env, config.get(), getConfig(), and dataflow propagation.
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { DynamicReferenceResolver } from '../../references/dynamicReferenceResolver';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class JavascriptAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'typescript';
  readonly extensions = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'];
  private dynamicResolver = new DynamicReferenceResolver();

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];

    // 1. Direct Catalog Patterns (Level 1, Level 2, Level 3)
    const catalogRefs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'javascript');
    references.push(...catalogRefs);

    // 2. Normalized Variants (Level 4) if no exact catalog matches in this file
    if (references.length === 0) {
      const normRefs = this.matchNormalizedVariants(key, indexedFile, fileInfo, 'javascript');
      references.push(...normRefs);
    }

    // 3. Dynamic & Dataflow Resolution (Level 5 & Level 6)
    const dynamicRefs = this.dynamicResolver.resolveDynamicReferences(key, indexedFile);
    references.push(...dynamicRefs);

    return references;
  }
}
