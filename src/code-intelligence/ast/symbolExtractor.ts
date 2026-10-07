/**
 * Configuration Debt Tracker - Symbol & Scope Extractor
 * Extracts functions, methods, classes, and modules to map configuration access
 * to their enclosing code symbols and build static dependency evidence.
 */

import { SymbolInfo } from '../../models/usage';
import { StructuredLine } from './nodeExtractor';

export class SymbolExtractor {
  /**
   * Extracts top-level and nested symbols from structured lines
   */
  extractSymbols(lines: StructuredLine[], filePath: string, _language: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    // Language specific function/class detection patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.isPureComment) continue;

      const code = line.codeOnlyText.trim();
      if (!code) continue;

      // 1. Class declarations: class Name ...
      const classMatch = code.match(/\bclass\s+([A-Za-z0-9_$]+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: 'class',
          startLine: line.lineNumber,
          endLine: this.estimateBlockEnd(lines, i),
          filePath
        });
        continue;
      }

      // 2. JavaScript / TypeScript functions:
      // function foo() | const foo = () => | const foo = function() | async function foo()
      const jsFuncMatch = code.match(/(?:(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+))|(?:(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>)/);
      if (jsFuncMatch) {
        const name = jsFuncMatch[1] || jsFuncMatch[2];
        if (name) {
          symbols.push({
            name,
            kind: 'function',
            startLine: line.lineNumber,
            endLine: this.estimateBlockEnd(lines, i),
            filePath
          });
          continue;
        }
      }

      // 3. Python def function( | async def function(
      const pyFuncMatch = code.match(/(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
      if (pyFuncMatch) {
        symbols.push({
          name: pyFuncMatch[1],
          kind: 'function',
          startLine: line.lineNumber,
          endLine: this.estimatePythonBlockEnd(lines, i),
          filePath
        });
        continue;
      }

      // 4. Java / C# / C++ methods: public void foo( | int calculateBar(
      const javaMethodMatch = code.match(/(?:public|protected|private|static|final|\s)*\s+[A-Za-z0-9_<>[\],]+\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{?/);
      if (javaMethodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(javaMethodMatch[1])) {
        symbols.push({
          name: javaMethodMatch[1],
          kind: 'method',
          startLine: line.lineNumber,
          endLine: this.estimateBlockEnd(lines, i),
          filePath
        });
        continue;
      }

      // 5. Go functions: func foo( | func (r *Repo) foo(
      const goFuncMatch = code.match(/func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (goFuncMatch) {
        symbols.push({
          name: goFuncMatch[1],
          kind: 'function',
          startLine: line.lineNumber,
          endLine: this.estimateBlockEnd(lines, i),
          filePath
        });
        continue;
      }

      // 6. Rust functions: fn foo( | pub fn foo(
      const rustFuncMatch = code.match(/(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*\(/);
      if (rustFuncMatch) {
        symbols.push({
          name: rustFuncMatch[1],
          kind: 'function',
          startLine: line.lineNumber,
          endLine: this.estimateBlockEnd(lines, i),
          filePath
        });
        continue;
      }
    }

    return symbols;
  }

  /**
   * Finds the deepest enclosing symbol for a specific line number
   */
  findEnclosingSymbol(symbols: SymbolInfo[], line: number): SymbolInfo | undefined {
    let bestMatch: SymbolInfo | undefined;
    let smallestSpan = Infinity;

    for (const sym of symbols) {
      if (line >= sym.startLine && line <= sym.endLine) {
        const span = sym.endLine - sym.startLine;
        if (span < smallestSpan) {
          smallestSpan = span;
          bestMatch = sym;
        }
      }
    }

    return bestMatch;
  }

  private estimateBlockEnd(lines: StructuredLine[], startIndex: number): number {
    let braceCount = 0;
    let started = false;

    for (let i = startIndex; i < lines.length; i++) {
      const code = lines[i].codeOnlyText;
      for (const char of code) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
          if (started && braceCount <= 0) {
            return lines[i].lineNumber;
          }
        }
      }
      // Safety limit: if 100 lines passed without closing, return current
      if (i - startIndex > 100) break;
    }

    return Math.min(lines.length, lines[startIndex].lineNumber + 15);
  }

  private estimatePythonBlockEnd(lines: StructuredLine[], startIndex: number): number {
    const startLine = lines[startIndex].originalText;
    const startIndent = startLine.search(/\S|$/);

    for (let i = startIndex + 1; i < lines.length; i++) {
      const raw = lines[i].originalText;
      if (!raw.trim()) continue;
      const currentIndent = raw.search(/\S|$/);
      if (currentIndent <= startIndent) {
        return lines[i - 1].lineNumber;
      }
    }

    return lines[lines.length - 1]?.lineNumber || lines[startIndex].lineNumber + 10;
  }
}
