/**
 * Configuration Debt Tracker - Python Source Usage Analyzer
 * Detects os.environ, os.getenv, settings, env(), and string literal references.
 */

import { SupportedSourceLanguage, UsageReference, UsageType } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { ILanguageAnalyzer } from '../baseLanguageAnalyzer';

export class PythonAnalyzer implements ILanguageAnalyzer {
  readonly language: SupportedSourceLanguage = 'python';

  canAnalyze(fileInfo: ScannedFileInfo): boolean {
    return fileInfo.extension === '.py';
  }

  findReferences(
    key: string,
    content: string,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];
    const lines = content.split(/\r?\n/);
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. os.environ["KEY"] or os.environ['KEY']
    const osEnvironIndex = new RegExp(`(?:os\\.)?environ\\[['"]${escapedKey}['"]\\]`, 'g');
    // 2. os.environ.get("KEY") or environ.get("KEY")
    const osEnvironGet = new RegExp(`(?:os\\.)?environ\\.get\\(['"]${escapedKey}['"]`, 'g');
    // 3. os.getenv("KEY")
    const osGetenv = new RegExp(`(?:os\\.)?getenv\\(['"]${escapedKey}['"]`, 'g');
    // 4. decouple / django-environ / pydantic: config("KEY"), env("KEY")
    const configFunc = new RegExp(`(?:config|env)\\(['"]${escapedKey}['"]`, 'g');
    // 5. settings.KEY
    const settingsProp = new RegExp(`\\bsettings\\.${escapedKey}\\b`, 'g');
    // 6. Generic string literal in Python code
    const literalPattern = new RegExp(`['"]${escapedKey}['"]`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Ignore pure comment lines
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        continue;
      }

      let matched = false;

      if (osEnvironIndex.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 99, 'os.environ["..."]');
      }

      if (!matched && osEnvironGet.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 98, 'os.environ.get(...)');
      }

      if (!matched && osGetenv.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 98, 'os.getenv(...)');
      }

      if (!matched && configFunc.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 95, 'env(...)');
      }

      if (!matched && settingsProp.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 92, 'settings.KEY');
      }

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
      language: 'python',
      usageType,
      confidence,
      confidenceLevel: confidence >= 95 ? 1 : 3,
      patternMatched: pattern
    });
  }
}
