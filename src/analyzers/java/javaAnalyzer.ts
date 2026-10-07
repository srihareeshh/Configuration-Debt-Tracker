/**
 * Configuration Debt Tracker - Java Source Usage Analyzer
 * Detects Spring @Value, System.getenv, System.getProperty, @ConfigProperty, and string literals.
 */

import { SupportedSourceLanguage, UsageReference, UsageType } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { ILanguageAnalyzer } from '../baseLanguageAnalyzer';

export class JavaAnalyzer implements ILanguageAnalyzer {
  readonly language: SupportedSourceLanguage = 'java';

  canAnalyze(fileInfo: ScannedFileInfo): boolean {
    return fileInfo.extension === '.java';
  }

  findReferences(
    key: string,
    content: string,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const references: UsageReference[] = [];
    const lines = content.split(/\r?\n/);
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Spring @Value("${key}") or @Value("${key:default}")
    const springValue = new RegExp(`@Value\\(\\s*["']\\$\\{${escapedKey}(?::[^}]*)?\\}["']\\s*\\)`, 'g');
    // 2. System.getenv("KEY")
    const systemGetenv = new RegExp(`System\\.getenv\\(\\s*["']${escapedKey}["']\\s*\\)`, 'g');
    // 3. System.getProperty("key")
    const systemGetProp = new RegExp(`System\\.getProperty\\(\\s*["']${escapedKey}["']\\s*\\)`, 'g');
    // 4. MicroProfile / Quarkus @ConfigProperty(name = "key")
    const configProperty = new RegExp(`@ConfigProperty\\(\\s*name\\s*=\\s*["']${escapedKey}["']`, 'g');
    // 5. Generic string literal in Java
    const literalPattern = new RegExp(`["']${escapedKey}["']`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      let matched = false;

      if (springValue.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 99, '@Value("${...}")');
      }

      if (!matched && systemGetenv.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 98, 'System.getenv(...)');
      }

      if (!matched && systemGetProp.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 97, 'System.getProperty(...)');
      }

      if (!matched && configProperty.test(line)) {
        matched = true;
        this.addReference(references, fileInfo, lineNum, line, 'exact', 95, '@ConfigProperty(...)');
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
      language: 'java',
      usageType,
      confidence,
      confidenceLevel: confidence >= 95 ? 1 : 3,
      patternMatched: pattern
    });
  }
}
