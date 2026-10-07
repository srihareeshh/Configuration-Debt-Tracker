/**
 * Configuration Debt Tracker - Dynamic & Dataflow Reference Resolver
 * Implements Level 5 (Dataflow / Local Variable Propagation) and
 * Level 6 (Dynamic Key Construction) reference detection.
 */

import { UsageReference } from '../../models/usage';
import { IndexedSourceFile } from '../ast/astIndexer';

export class DynamicReferenceResolver {
  /**
   * Evaluates dataflow propagation and dynamic concatenation for a given configuration key.
   */
  resolveDynamicReferences(
    key: string,
    indexedFile: IndexedSourceFile
  ): UsageReference[] {
    const references: UsageReference[] = [];

    // 1. LEVEL 5: DATAFLOW PROPAGATION
    // Look for variable assignment where variable holding key is used in env lookup
    // e.g. const key = "DATABASE_URL"; process.env[key] or os.getenv(key)
    for (const lit of indexedFile.stringLiterals) {
      if (lit.value === key && lit.assignedVariableName) {
        const varName = lit.assignedVariableName;
        // Search subsequent lines for env[varName] or getenv(varName)
        for (const line of indexedFile.lines) {
          if (line.lineNumber >= lit.line && !line.isPureComment) {
            const code = line.codeOnlyText;
            const lookupPattern = new RegExp(`(?:env\\[|getenv\\(|get\\(|environ\\[)${varName}[\\],)]`);
            if (lookupPattern.test(code)) {
              references.push({
                filePath: indexedFile.filePath,
                absoluteFilePath: indexedFile.filePath,
                line: line.lineNumber,
                column: 1,
                snippet: line.originalText.trim(),
                language: indexedFile.language as any,
                usageType: 'dataflow',
                confidence: 82,
                confidenceLevel: 5,
                patternMatched: `Dataflow propagation: ${varName} = '${key}' -> ${code.trim()}`,
                enclosingSymbol: this.findEnclosingSymbol(indexedFile, line.lineNumber),
                isTestFile: indexedFile.isTestFile
              });
            }
          }
        }
      }
    }

    // 2. LEVEL 6: DYNAMIC KEY CONSTRUCTION
    // Check for expressions like process.env[prefix + "URL"] or "DATABASE_" + "URL"
    if (key.includes('_')) {
      const parts = key.split('_');
      const prefix = parts[0] + '_';
      const suffix = parts.slice(1).join('_');

      for (const line of indexedFile.lines) {
        if (!line.isPureComment) {
          const code = line.codeOnlyText;
          // Check for concatenation patterns like 'DATABASE_' + or + 'URL'
          if (
            (code.includes(`'${prefix}'`) || code.includes(`"${prefix}"`)) &&
            (code.includes(`'${suffix}'`) || code.includes(`"${suffix}"`) || code.includes('env['))
          ) {
            references.push({
              filePath: indexedFile.filePath,
              absoluteFilePath: indexedFile.filePath,
              line: line.lineNumber,
              column: 1,
              snippet: line.originalText.trim(),
              language: indexedFile.language as any,
              usageType: 'dynamic',
              confidence: 65,
              confidenceLevel: 6,
              patternMatched: `Dynamic construction: concatenation containing prefix '${prefix}' or suffix '${suffix}'`,
              enclosingSymbol: this.findEnclosingSymbol(indexedFile, line.lineNumber),
              isTestFile: indexedFile.isTestFile
            });
          }
        }
      }
    }

    return references;
  }

  private findEnclosingSymbol(indexedFile: IndexedSourceFile, line: number) {
    return indexedFile.symbols.find((s) => line >= s.startLine && line <= s.endLine);
  }
}
