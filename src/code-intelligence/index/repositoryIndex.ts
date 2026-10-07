/**
 * Configuration Debt Tracker - Repository Knowledge Index
 * Indexes repository structure, configuration items, AST symbols, references, and findings
 * to support targeted retrieval (RAG) and code impact analysis.
 */

import { ConfigurationItem } from '../../models/configuration';
import { DebtFinding } from '../../models/finding';
import { SymbolInfo, UsageAnalysis, UsageReference } from '../../models/usage';
import { IndexedSourceFile } from '../ast/astIndexer';

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
      allSymbols.push(...sf.symbols);
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

  findConfigItem(key: string): ConfigurationItem | undefined {
    if (!this.currentIndex) return undefined;
    const lower = key.toLowerCase();
    return this.currentIndex.configurationItems.find(
      (item) => item.key.toLowerCase() === lower
    );
  }

  findFindingsForKey(key: string): DebtFinding[] {
    if (!this.currentIndex) return [];
    const lower = key.toLowerCase();
    return this.currentIndex.findings.filter(
      (f) => f.configurationItem.key.toLowerCase() === lower
    );
  }

  findReferencesForKey(key: string): UsageReference[] {
    if (!this.currentIndex) return [];
    const usage = this.currentIndex.usageMap[key];
    return usage?.references || [];
  }

  findSymbolsInFile(filePath: string): SymbolInfo[] {
    if (!this.currentIndex) return [];
    return this.currentIndex.allSymbols.filter((s) => s.filePath === filePath);
  }
}
