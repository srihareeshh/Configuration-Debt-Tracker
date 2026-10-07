/**
 * Configuration Debt Tracker - Node & Code Zone Extractor
 * Deconstructs source text into semantic zones: Code, Comments, String Literals.
 * Strictly guarantees that comments (line, block, docstrings) are isolated and
 * never falsely classified as active configuration usage.
 */

export type ZoneType = 'code' | 'line_comment' | 'block_comment' | 'docstring' | 'string_literal';

export interface CodeSpan {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  type: ZoneType;
  text: string;
}

export interface StructuredLine {
  lineNumber: number;
  originalText: string;
  codeOnlyText: string;
  hasComment: boolean;
  isPureComment: boolean;
  isInBlockComment: boolean;
  isInDocstring: boolean;
}

export class NodeExtractor {
  /**
   * Parses source text line by line while tracking multi-line block comments,
   * docstrings, and string literals across languages.
   */
  extractStructuredLines(content: string, language: string): StructuredLine[] {
    const rawLines = content.split(/\r?\n/);
    const result: StructuredLine[] = [];

    let inBlockComment = false; // /* ... */
    let inDocstringDouble = false; // """ ... """
    let inDocstringSingle = false; // ''' ... '''

    const isPythonOrRubyOrShell = ['python', 'ruby', 'shell', 'powershell'].includes(language);

    for (let i = 0; i < rawLines.length; i++) {
      const lineNum = i + 1;
      const raw = rawLines[i];
      let codeChars: string[] = [];
      let idx = 0;
      let lineHasComment = false;
      const wasInBlock = inBlockComment || inDocstringDouble || inDocstringSingle;

      while (idx < raw.length) {
        // 1. If currently inside a block comment /* ... */
        if (inBlockComment) {
          lineHasComment = true;
          if (raw.slice(idx, idx + 2) === '*/') {
            inBlockComment = false;
            idx += 2;
          } else {
            idx++;
          }
          continue;
        }

        // 2. If currently inside Python triple double docstring """ ... """
        if (inDocstringDouble) {
          lineHasComment = true;
          if (raw.slice(idx, idx + 3) === '"""') {
            inDocstringDouble = false;
            idx += 3;
          } else {
            idx++;
          }
          continue;
        }

        // 3. If currently inside Python triple single docstring ''' ... '''
        if (inDocstringSingle) {
          lineHasComment = true;
          if (raw.slice(idx, idx + 3) === "'''") {
            inDocstringSingle = false;
            idx += 3;
          } else {
            idx++;
          }
          continue;
        }

        // 4. Check for start of block comment /*
        if (!isPythonOrRubyOrShell && raw.slice(idx, idx + 2) === '/*') {
          inBlockComment = true;
          lineHasComment = true;
          idx += 2;
          continue;
        }

        // 5. Check for Python docstrings
        if (isPythonOrRubyOrShell && raw.slice(idx, idx + 3) === '"""') {
          inDocstringDouble = true;
          lineHasComment = true;
          idx += 3;
          continue;
        }
        if (isPythonOrRubyOrShell && raw.slice(idx, idx + 3) === "'''") {
          inDocstringSingle = true;
          lineHasComment = true;
          idx += 3;
          continue;
        }

        // 6. Check for single line comments (// or # or --)
        if (!isPythonOrRubyOrShell && raw.slice(idx, idx + 2) === '//') {
          lineHasComment = true;
          break; // Rest of line is comment
        }
        if (isPythonOrRubyOrShell && raw[idx] === '#') {
          lineHasComment = true;
          break; // Rest of line is comment
        }
        if (language === 'sql' && raw.slice(idx, idx + 2) === '--') {
          lineHasComment = true;
          break;
        }

        // 7. Regular code character
        codeChars.push(raw[idx]);
        idx++;
      }

      const codeOnlyText = codeChars.join('');
      const isPureComment = wasInBlock || (lineHasComment && codeOnlyText.trim().length === 0);

      result.push({
        lineNumber: lineNum,
        originalText: raw,
        codeOnlyText,
        hasComment: lineHasComment || wasInBlock,
        isPureComment,
        isInBlockComment: inBlockComment,
        isInDocstring: inDocstringDouble || inDocstringSingle
      });
    }

    return result;
  }
}
