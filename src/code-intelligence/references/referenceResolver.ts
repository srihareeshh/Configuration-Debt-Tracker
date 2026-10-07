/**
 * Configuration Debt Tracker - Reference Resolver (Module 2 Engine)
 * Discovers and maps configuration references across the entire repository
 * with calibrated 7-tier confidence ratings and test-isolation detection.
 */

import { UsageAnalysis, UsageReference } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { ParserManager } from '../parser/parserManager';

export class ReferenceResolver {
  private parserManager: ParserManager;

  constructor(parserManager: ParserManager = new ParserManager()) {
    this.parserManager = parserManager;
  }

  /**
   * Resolves all source code references for a configuration key
   */
  resolveKeyReferences(
    key: string,
    sourceFiles: ScannedFileInfo[],
    fileContents: Map<string, string>
  ): UsageAnalysis {
    const allRefs: UsageReference[] = [];

    for (const file of sourceFiles) {
      const content = fileContents.get(file.relativePath);
      if (!content) continue;

      const refs = this.parserManager.findReferencesForKey(key, file, content);
      allRefs.push(...refs);
    }

    // Sort references by confidence descending
    allRefs.sort((a, b) => b.confidence - a.confidence);

    const isUsed = allRefs.length > 0;
    const maxConfidence = allRefs.length > 0 ? allRefs[0].confidence : 0;
    const highestLevel = allRefs.length > 0 ? allRefs[0].confidenceLevel : undefined;

    let statusText: 'Used' | 'Possible usage' | 'Unused' = 'Unused';
    if (isUsed) {
      if (highestLevel && highestLevel <= 3) {
        statusText = 'Used';
      } else if (highestLevel && highestLevel <= 6) {
        statusText = 'Possible usage';
      } else {
        statusText = 'Possible usage';
      }
    }

    const referencingFiles = Array.from(new Set(allRefs.map((r) => r.filePath)));
    const isTestOnly = isUsed && allRefs.every((r) => r.isTestFile);

    return {
      key,
      isUsed,
      confidence: maxConfidence,
      highestConfidenceLevel: highestLevel,
      statusText,
      referenceCount: allRefs.length,
      references: allRefs,
      referencingFiles,
      isTestOnly
    };
  }

  getParserManager(): ParserManager {
    return this.parserManager;
  }
}
