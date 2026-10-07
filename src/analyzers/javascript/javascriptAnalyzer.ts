/**
 * Configuration Debt Tracker - JavaScript & TypeScript Source Usage Analyzer
 * Detects process.env, import.meta.env, config.get(), and string literal references.
 */

import { SupportedSourceLanguage, UsageReference, UsageType } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { ILanguageAnalyzer } from '../baseLanguageAnalyzer';

export class JavascriptAnalyzer implements ILanguageAnalyzer {
  readonly language: SupportedSourceLanguage = 'typescript';

  canAnalyze(fileInfo: ScannedFileInfo): boolean {
    const ext = fileInfo.extension;
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  }

  findReferences(
    key: string,
    content: string,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];
    const lines = content.split(/\r?\n/);
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Direct process.env.KEY or import.meta.env.KEY
    const directPropPattern = new RegExp(`(?:process\\.env|import\\.meta\\.env)\\.${escapedKey}\\b`, 'g');
    // 2. Index access: process.env['KEY'] or import.meta.env["KEY"]
    const indexPropPattern = new RegExp(`(?:process\\.env|import\\.meta\\.env)\\[['"\`]${escapedKey}['"\`]\\]`, 'g');
    // 3. Configuration libraries: config.get('KEY') or env('KEY')
    const configGetPattern = new RegExp(`(?:config\\.get|env|getenv)\\(?['"\`]${escapedKey}['"\`]\\)?`, 'g');
    // 4. Literal match anywhere in code
    const literalPattern = new RegExp(`['"\`]${escapedKey}['"\`]`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Ignore pure comment lines
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      let matched = false;

      // Check Direct Prop
      if (directPropPattern.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 98, `${line.match(directPropPattern)?.[0]}`);
      }

      // Check Index Access
      if (!matched && indexPropPattern.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 98, `${line.match(indexPropPattern)?.[0]}`);
      }

      // Check Config Library Access
      if (!matched && configGetPattern.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 95, `${line.match(configGetPattern)?.[0]}`);
      }

      // Check General Literal Reference
      if (!matched && literalPattern.test(line)) {
        this.addReference(references, fileInfo, lineNum, line, 'dynamic', 75, `Literal: '${key}'`);
      }
    }

    return references;
  }

  private addReference(
    references: UsageReference[],
    fileInfo: ScannedFileInfo,
    line: number,
    snippet: string,
    usageType: UsageType,
    confidence: number,
    pattern: string
  ): void {
    references.push({
      filePath: fileInfo.relativePath,
      absoluteFilePath: fileInfo.absolutePath,
      line,
      column: 1,
      snippet: snippet.trim(),
      language: fileInfo.extension.startsWith('.t') ? 'typescript' : 'javascript',
      usageType,
      confidence,
      confidenceLevel: confidence >= 95 ? 1 : 3,
      patternMatched: pattern
    });
  }
}
