/**
 * Configuration Debt Tracker - Code Impact Analyzer
 * Evaluates static dependency evidence: "What breaks if I delete this?"
 * Maps: Configuration Declaration -> References -> Enclosing Functions -> Modules -> Dependent Files.
 */

import { ImpactAnalysisResult, ScanResult } from '../../models/scan';
import { UsageReference } from '../../models/usage';

export class ImpactAnalyzer {
  /**
   * Assesses the static removal impact of a configuration key
   */
  assessRemovalImpact(key: string, scanResult: ScanResult): ImpactAnalysisResult {
    const matchingItems = scanResult.items.filter(
      (i) => i.key.toLowerCase() === key.toLowerCase()
    );

    const declaredLocations = matchingItems.map((i) => ({
      file: i.filePath,
      line: i.line,
      format: i.format
    }));

    const usage = scanResult.usageMap[key];
    const references: UsageReference[] = usage?.references || [];

    const affectedFiles = Array.from(new Set(references.map((r) => r.filePath)));

    const affectedSymbols: { name: string; kind: string; file: string; line: number }[] = [];
    const seenSymbols = new Set<string>();

    for (const r of references) {
      if (r.enclosingSymbol) {
        const id = `${r.filePath}:${r.enclosingSymbol.name}`;
        if (!seenSymbols.has(id)) {
          seenSymbols.add(id);
          affectedSymbols.push({
            name: r.enclosingSymbol.name,
            kind: r.enclosingSymbol.kind,
            file: r.filePath,
            line: r.line
          });
        }
      }
    }

    const staticDependencyEvidence = references.slice(0, 10).map((r) => ({
      file: r.filePath,
      line: r.line,
      snippet: r.snippet,
      confidence: r.confidence
    }));

    // Impact Level determination
    let impactLevel: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
    if (references.length > 5 || affectedFiles.length > 3) {
      impactLevel = 'Critical';
    } else if (references.length > 1 || affectedFiles.length > 1) {
      impactLevel = 'High';
    } else if (references.length === 1) {
      impactLevel = 'Medium';
    } else {
      impactLevel = 'Low';
    }

    const blindSpots = [
      'Dynamically constructed key access (e.g. process.env[prefix + name])',
      'External orchestration manifests (Kubernetes, Helm, Docker Compose outside workspace)',
      'CI/CD pipeline environment variable injection',
      'Reflection or metadata-driven property lookup'
    ];

    let removalAdvisory = '';
    if (references.length === 0) {
      removalAdvisory = `No static source-code references detected (Confidence: 96%). Verify external deployment manifests before removing '${key}' from ${declaredLocations.map((d) => d.file).join(', ')}.`;
    } else {
      removalAdvisory = `Removing '${key}' will affect ${references.length} statically identified source location(s) across ${affectedFiles.length} file(s). Ensure all consumers (${affectedSymbols.map((s) => s.name).join(', ') || 'top-level callers'}) are refactored before deletion.`;
    }

    return {
      configurationKey: key,
      declaredLocations,
      staticReferenceCount: references.length,
      affectedFilesCount: affectedFiles.length,
      affectedFiles,
      affectedSymbols,
      staticDependencyEvidence,
      confidence: usage ? usage.confidence : 95,
      impactLevel,
      blindSpots,
      removalAdvisory
    };
  }
}
