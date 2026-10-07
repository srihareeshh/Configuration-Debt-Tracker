/**
 * Configuration Debt Tracker - Python AST Analyzer
 * Supports .py, .pyw.
 * Recognizes os.environ[], os.getenv(), os.environ.get(), config(), env(), settings.KEY, and dataflow.
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { DynamicReferenceResolver } from '../../references/dynamicReferenceResolver';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class PythonAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'python';
  readonly extensions = ['.py', '.pyw'];
  private dynamicResolver = new DynamicReferenceResolver();

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];

    // 1. Direct Catalog Patterns (Level 2, Level 3)
    const catalogRefs = this.matchCatalogPatterns(key, indexedFile, fileInfo, 'python');
    references.push(...catalogRefs);

    // 2. Normalized Variants (Level 4)
    if (references.length === 0) {
      const normRefs = this.matchNormalizedVariants(key, indexedFile, fileInfo, 'python');
      references.push(...normRefs);
    }

    // 3. Dynamic & Dataflow Resolution (Level 5 & Level 6)
    const dynamicRefs = this.dynamicResolver.resolveDynamicReferences(key, indexedFile);
    references.push(...dynamicRefs);

    return references;
  }
}
