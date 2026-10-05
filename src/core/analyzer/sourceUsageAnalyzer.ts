/**
 * Configuration Debt Tracker - Source Usage Analyzer (Module 2)
 * Discovers and maps references from source code to configuration keys with confidence metrics.
 * Directly implements SCM Configuration Audit.
 */

import * as fs from 'fs';
import { ILanguageAnalyzer } from '../../analyzers/baseLanguageAnalyzer';
import { GenericAnalyzer, getKeyVariants } from '../../analyzers/generic/genericAnalyzer';
import { JavaAnalyzer } from '../../analyzers/java/javaAnalyzer';
import { JavascriptAnalyzer } from '../../analyzers/javascript/javascriptAnalyzer';
import { PythonAnalyzer } from '../../analyzers/python/pythonAnalyzer';
import { ConfigurationItem } from '../../models/configuration';
import { UsageAnalysis, UsageReference } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';

export interface AnalyzerProgressCallback {
  (current: number, total: number, currentKey: string): void;
}

export class SourceUsageAnalyzer {
  private analyzers: ILanguageAnalyzer[];
  private genericAnalyzer: GenericAnalyzer;

  constructor() {
    this.analyzers = [
      new JavascriptAnalyzer(),
      new PythonAnalyzer(),
      new JavaAnalyzer()
    ];
    this.genericAnalyzer = new GenericAnalyzer();
  }

  /**
   * Analyzes all configuration items against all source files in the workspace.
   */
  async analyzeUsage(
    items: ConfigurationItem[],
    allFiles: ScannedFileInfo[],
    onProgress?: AnalyzerProgressCallback
  ): Promise<Record<string, UsageAnalysis>> {
    const usageMap: Record<string, UsageAnalysis> = {};

    // 1. Filter source files only (exclude configuration files and binaries)
    const sourceFiles = allFiles.filter((f) => {
      return (
        this.analyzers.some((a) => a.canAnalyze(f)) ||
        this.genericAnalyzer.canAnalyze(f)
      );
    });

    // 2. Pre-read source files in memory for fast parallel scanning
    const fileContents = new Map<string, string>();
    for (const file of sourceFiles) {
      try {
        const content = await fs.promises.readFile(file.absolutePath, 'utf-8');
        fileContents.set(file.relativePath, content);
      } catch {
        // Skip unreadable files
      }
    }

    // 3. Extract unique configuration keys to avoid redundant searches
    const uniqueKeys = Array.from(new Set(items.map((item) => item.key)));

    for (let i = 0; i < uniqueKeys.length; i++) {
      const key = uniqueKeys[i];
      if (onProgress) {
        onProgress(i + 1, uniqueKeys.length, key);
      }

      const references: UsageReference[] = [];
      const variants = getKeyVariants(key);

      // Search each source file
      for (const sourceFile of sourceFiles) {
        const content = fileContents.get(sourceFile.relativePath);
        if (!content) {
          continue;
        }

        // Try language-specific analyzer
        let handled = false;
        for (const analyzer of this.analyzers) {
          if (analyzer.canAnalyze(sourceFile)) {
            handled = true;
            // 1. Exact key match
            const exactRefs = analyzer.findReferences(key, content, sourceFile);
            references.push(...exactRefs);

            // 2. Check variants if no exact match found in this file
            if (exactRefs.length === 0) {
              for (const variant of variants) {
                const variantRefs = analyzer.findReferences(variant, content, sourceFile);
                for (const vRef of variantRefs) {
                  references.push({
                    ...vRef,
                    usageType: 'normalized',
                    confidence: Math.round(vRef.confidence * 0.8), // 80% of original
                    patternMatched: `Normalized variant '${variant}'`
                  });
                }
              }
            }
            break;
          }
        }

        // If not handled by specific analyzer, try generic analyzer
        if (!handled && this.genericAnalyzer.canAnalyze(sourceFile)) {
          const genRefs = this.genericAnalyzer.findReferences(key, content, sourceFile);
          references.push(...genRefs);
        }
      }

      // Deduplicate references at same file:line
      const uniqueRefs = this.deduplicateReferences(references);

      // Compute aggregate confidence
      const referenceCount = uniqueRefs.length;
      const isUsed = referenceCount > 0;
      let highestConfidence = 0;
      for (const ref of uniqueRefs) {
        if (ref.confidence > highestConfidence) {
          highestConfidence = ref.confidence;
        }
      }

      let statusText: 'Used' | 'Possible usage' | 'Unused';
      if (!isUsed) {
        statusText = 'Unused';
      } else if (highestConfidence >= 85) {
        statusText = 'Used';
      } else {
        statusText = 'Possible usage';
      }

      const referencingFiles = Array.from(new Set(uniqueRefs.map((r) => r.filePath)));

      usageMap[key] = {
        key,
        isUsed,
        confidence: highestConfidence,
        statusText,
        referenceCount,
        references: uniqueRefs,
        referencingFiles
      };
    }

    return usageMap;
  }

  private deduplicateReferences(references: UsageReference[]): UsageReference[] {
    const seen = new Set<string>();
    const result: UsageReference[] = [];

    for (const ref of references) {
      const id = `${ref.filePath}:${ref.line}:${ref.usageType}`;
      if (!seen.has(id)) {
        seen.add(id);
        result.push(ref);
      }
    }

    return result;
  }
}
