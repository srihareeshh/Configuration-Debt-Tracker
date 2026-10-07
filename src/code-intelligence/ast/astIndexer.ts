/**
 * Configuration Debt Tracker - AST & File Indexer
 * Parses and indexes a source file into structured lines, symbols, imports, and string tokens.
 */

import { SymbolInfo } from '../../models/usage';
import { ImportExtractor, ImportInfo } from './importExtractor';
import { NodeExtractor, StructuredLine } from './nodeExtractor';
import { ExtractedStringLiteral, StringExtractor } from './stringExtractor';
import { SymbolExtractor } from './symbolExtractor';

export interface IndexedSourceFile {
  filePath: string;
  language: string;
  lines: StructuredLine[];
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  stringLiterals: ExtractedStringLiteral[];
  hasConfigurationImports: boolean;
  isTestFile: boolean;
}

export class AstIndexer {
  private nodeExtractor = new NodeExtractor();
  private symbolExtractor = new SymbolExtractor();
  private importExtractor = new ImportExtractor();
  private stringExtractor = new StringExtractor();

  indexSource(content: string, filePath: string, language: string): IndexedSourceFile {
    const isTestFile = this.checkIsTestFile(filePath);
    const lines = this.nodeExtractor.extractStructuredLines(content, language);
    const symbols = this.symbolExtractor.extractSymbols(lines, filePath, language);
    const imports = this.importExtractor.extractImports(lines, language);
    const stringLiterals = this.stringExtractor.extractStringLiterals(lines);

    const hasConfigurationImports = imports.some((imp) =>
      ['dotenv', 'os', 'config', 'env', 'viper', 'spring', 'settings'].some((kw) =>
        imp.moduleName.toLowerCase().includes(kw)
      )
    );

    return {
      filePath,
      language,
      lines,
      symbols,
      imports,
      stringLiterals,
      hasConfigurationImports,
      isTestFile
    };
  }

  private checkIsTestFile(filePath: string): boolean {
    const lower = filePath.toLowerCase().replace(/\\/g, '/');
    return (
      lower.includes('/test/') ||
      lower.includes('/tests/') ||
      lower.includes('/__tests__/') ||
      lower.includes('/spec/') ||
      lower.endsWith('.test.ts') ||
      lower.endsWith('.test.js') ||
      lower.endsWith('.spec.ts') ||
      lower.endsWith('.spec.js') ||
      lower.endsWith('_test.go') ||
      lower.endsWith('_test.py') ||
      lower.endsWith('test.py') ||
      lower.includes('testcase')
    );
  }
}
