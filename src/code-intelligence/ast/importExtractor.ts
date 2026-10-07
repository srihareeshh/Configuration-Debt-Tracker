/**
 * Configuration Debt Tracker - Import & Dependency Extractor
 * Identifies imported configuration modules and packages across languages:
 * e.g. dotenv, os, config, @nestjs/config, viper, envy, etc.
 */

import { StructuredLine } from './nodeExtractor';

export interface ImportInfo {
  moduleName: string;
  importedSymbols: string[];
  alias?: string;
  line: number;
}

export class ImportExtractor {
  extractImports(lines: StructuredLine[], _language: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    for (const line of lines) {
      if (line.isPureComment) continue;
      const code = line.codeOnlyText.trim();
      if (!code) continue;

      // 1. JS / TS: import ... from '...'; or require('...')
      const esImportMatch = code.match(/import\s+(?:\{([^}]+)\}|\*\s+as\s+([A-Za-z0-9_$]+)|([A-Za-z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/);
      if (esImportMatch) {
        const symbols = esImportMatch[1] ? esImportMatch[1].split(',').map((s) => s.trim()) : [];
        const alias = esImportMatch[2] || esImportMatch[3];
        const moduleName = esImportMatch[4];
        imports.push({
          moduleName,
          importedSymbols: symbols,
          alias,
          line: line.lineNumber
        });
        continue;
      }

      const requireMatch = code.match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*require\(['"]([^'"]+)['"]\)/);
      if (requireMatch) {
        imports.push({
          moduleName: requireMatch[2],
          importedSymbols: [],
          alias: requireMatch[1],
          line: line.lineNumber
        });
        continue;
      }

      // 2. Python: import os, sys | from dotenv import load_dotenv
      const pyFromMatch = code.match(/from\s+([A-Za-z0-9_.]+)\s+import\s+(.+)/);
      if (pyFromMatch) {
        const symbols = pyFromMatch[2].split(',').map((s) => s.trim());
        imports.push({
          moduleName: pyFromMatch[1],
          importedSymbols: symbols,
          line: line.lineNumber
        });
        continue;
      }

      const pyImportMatch = code.match(/import\s+([A-Za-z0-9_.]+)(?:\s+as\s+([A-Za-z0-9_]+))?/);
      if (pyImportMatch) {
        imports.push({
          moduleName: pyImportMatch[1],
          importedSymbols: [],
          alias: pyImportMatch[2],
          line: line.lineNumber
        });
        continue;
      }

      // 3. Go: import "os"
      const goImportMatch = code.match(/import\s+(?:\([^\)]+\)|"([^"]+)")/);
      if (goImportMatch && goImportMatch[1]) {
        imports.push({
          moduleName: goImportMatch[1],
          importedSymbols: [],
          line: line.lineNumber
        });
        continue;
      }
    }

    return imports;
  }
}
