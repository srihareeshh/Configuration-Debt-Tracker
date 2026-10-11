/**
 * Configuration Debt Tracker - Repository Knowledge Index
 * Indexes repository structure, configuration items, AST symbols, references, and findings
 * to support targeted retrieval (RAG) and code impact analysis.
 */

import { ConfigurationItem } from '../../models/configuration';
import { DebtFinding } from '../../models/finding';
import { SymbolInfo, UsageAnalysis, UsageReference } from '../../models/usage';
import { IndexedSourceFile } from '../ast/astIndexer';
import { canonicalizeKey } from '../references/normalizedKeyResolver';

export interface IndexedRepository {
  workspaceName: string;
  workspacePath: string;
  indexedAt: number;
  configurationItems: ConfigurationItem[];
  findings: DebtFinding[];
  usageMap: Record<string, UsageAnalysis>;
  sourceFiles: Map<string, IndexedSourceFile>;
  allSymbols: SymbolInfo[];
}

export class RepositoryIndex {
  private currentIndex: IndexedRepository | null = null;

  buildIndex(
    workspaceName: string,
    workspacePath: string,
    items: ConfigurationItem[],
    findings: DebtFinding[],
    usageMap: Record<string, UsageAnalysis>,
    sourceFiles: Map<string, IndexedSourceFile> = new Map()
  ): IndexedRepository {
    const allSymbols: SymbolInfo[] = [];
    for (const sf of sourceFiles.values()) {
      if (sf.symbols) {
        allSymbols.push(...sf.symbols);
      }
    }

    this.currentIndex = {
      workspaceName,
      workspacePath,
      indexedAt: Date.now(),
      configurationItems: items,
      findings,
      usageMap,
      sourceFiles,
      allSymbols
    };

    return this.currentIndex;
  }

  getIndex(): IndexedRepository | null {
    return this.currentIndex;
  }

  isIndexed(): boolean {
    return this.currentIndex !== null;
  }

  findConfigItem(key: string): ConfigurationItem | undefined {
    if (!this.currentIndex) return undefined;
    const lower = key.toLowerCase();
    const canon = canonicalizeKey(key);

    // 1. Exact match
    const exact = this.currentIndex.configurationItems.find((item) => item.key === key);
    if (exact) return exact;

    // 2. Case-insensitive match
    const caseMatch = this.currentIndex.configurationItems.find(
      (item) => item.key.toLowerCase() === lower
    );
    if (caseMatch) return caseMatch;

    // 3. Canonical match
    return this.currentIndex.configurationItems.find(
      (item) => canonicalizeKey(item.key) === canon
    );
  }

  findFindingsForKey(key: string): DebtFinding[] {
    if (!this.currentIndex) return [];
    const lower = key.toLowerCase();
    const canon = canonicalizeKey(key);

    return this.currentIndex.findings.filter((f) => {
      const fKey = f.configurationItem.key;
      return (
        fKey === key ||
        fKey.toLowerCase() === lower ||
        canonicalizeKey(fKey) === canon
      );
    });
  }

  /**
   * Retrieves all static references for a key with canonical and case-insensitive resolution.
   * Merges and deduplicates references across canonical identity variants.
   */
  findReferencesForKey(key: string): UsageReference[] {
    if (!this.currentIndex) return [];
    const lower = key.toLowerCase();
    const canon = canonicalizeKey(key);

    const mergedRefs: UsageReference[] = [];
    const seen = new Set<string>();

    for (const [mapKey, usage] of Object.entries(this.currentIndex.usageMap)) {
      const isMatch =
        mapKey === key ||
        mapKey.toLowerCase() === lower ||
        canonicalizeKey(mapKey) === canon;

      if (isMatch && usage.references) {
        for (const ref of usage.references) {
          const id = `${ref.filePath}:${ref.line}:${ref.column || 0}`;
          if (!seen.has(id)) {
            seen.add(id);
            mergedRefs.push(ref);
          }
        }
      }
    }

    // Sort by confidence descending
    mergedRefs.sort((a, b) => b.confidence - a.confidence);
    return mergedRefs;
  }

  findSymbolsInFile(filePath: string): SymbolInfo[] {
    if (!this.currentIndex) return [];
    const norm = filePath.replace(/\\/g, '/');
    return this.currentIndex.allSymbols.filter((s) => s.filePath.replace(/\\/g, '/') === norm);
  }

  findSymbolsByName(nameQuery: string): SymbolInfo[] {
    if (!this.currentIndex) return [];
    const lower = nameQuery.toLowerCase();
    return this.currentIndex.allSymbols.filter((s) => s.name.toLowerCase().includes(lower));
  }

  getSourceFile(filePath: string): IndexedSourceFile | undefined {
    if (!this.currentIndex) return undefined;
    const norm = filePath.replace(/\\/g, '/');
    for (const [p, sf] of this.currentIndex.sourceFiles.entries()) {
      if (p.replace(/\\/g, '/') === norm || p.endsWith(norm)) {
        return sf;
      }
    }
    return undefined;
  }

  getAllSourceFiles(): Map<string, IndexedSourceFile> {
    return this.currentIndex?.sourceFiles || new Map();
  }

  getAllSymbols(): SymbolInfo[] {
    return this.currentIndex?.allSymbols || [];
  }
}
