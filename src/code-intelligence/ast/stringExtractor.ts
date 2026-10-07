/**
 * Configuration Debt Tracker - String Literal & Variable Propagation Extractor
 * Extracts string literals from active code (excluding comments) to support
 * Level 2 index accesses, Level 5 local variable propagation, and Level 6 dynamic expressions.
 */

import { StructuredLine } from './nodeExtractor';

export interface ExtractedStringLiteral {
  value: string;
  line: number;
  column: number;
  isInsideConfigLookup: boolean;
  assignedVariableName?: string;
}

export class StringExtractor {
  /**
   * Extracts string literals and local variable assignments
   */
  extractStringLiterals(lines: StructuredLine[]): ExtractedStringLiteral[] {
    const literals: ExtractedStringLiteral[] = [];

    for (const line of lines) {
      if (line.isPureComment) continue;
      const code = line.codeOnlyText;
      if (!code.trim()) continue;

      // Check for local variable assignment: const key = "DATABASE_URL" or key = 'DATABASE_URL'
      const assignMatch = code.match(/(?:const|let|var|\b)?\s*([A-Za-z0-9_$]+)\s*=\s*['"`]([A-Za-z0-9_.\-:]+)['"`]/);
      let assignedVar: string | undefined;
      if (assignMatch) {
        assignedVar = assignMatch[1];
      }

      // Extract all string literals matching quotes
      const regex = /['"`]([A-Za-z0-9_.\-:]+)['"`]/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(code)) !== null) {
        const val = match[1];
        const col = match.index + 1;

        // Check if preceding context indicates config lookup (e.g. process.env[, os.getenv(, config.get()
        const pre = code.slice(Math.max(0, match.index - 20), match.index);
        const isConfigLookup =
          pre.includes('env[') ||
          pre.includes('getenv(') ||
          pre.includes('get(') ||
          pre.includes('environ[') ||
          pre.includes('var(');

        literals.push({
          value: val,
          line: line.lineNumber,
          column: col,
          isInsideConfigLookup: isConfigLookup,
          assignedVariableName: assignedVar
        });
      }
    }

    return literals;
  }
}
