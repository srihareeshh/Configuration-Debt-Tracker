/**
 * Configuration Debt Tracker - Parser Manager
 * Coordinates language detection, AST indexing, caching, and multi-language analyzer dispatch.
 */

import { UsageReference } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { AstIndexer, IndexedSourceFile } from '../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../languages/baseAnalyzer';
import { CAnalyzerV2 } from '../languages/c/cAnalyzer';
import { CSharpAnalyzerV2 } from '../languages/csharp/csharpAnalyzer';
import { GenericAnalyzerV2 } from '../languages/generic/genericAnalyzer';
import { GoAnalyzerV2 } from '../languages/go/goAnalyzer';
import { JavaAnalyzerV2 } from '../languages/java/javaAnalyzer';
import { JavascriptAnalyzerV2 } from '../languages/javascript/javascriptAnalyzer';
import { KotlinAnalyzerV2 } from '../languages/kotlin/kotlinAnalyzer';
import { PhpAnalyzerV2 } from '../languages/php/phpAnalyzer';
import { PythonAnalyzerV2 } from '../languages/python/pythonAnalyzer';
import { RubyAnalyzerV2 } from '../languages/ruby/rubyAnalyzer';
import { RustAnalyzerV2 } from '../languages/rust/rustAnalyzer';
import { ShellAnalyzerV2 } from '../languages/shell/shellAnalyzer';
import { LanguageDetector } from './languageDetector';
import { ParserCache } from './parserCache';

export class ParserManager {
  private languageDetector = new LanguageDetector();
  private astIndexer = new AstIndexer();
  private cache = new ParserCache();
  private analyzers: AbstractLanguageAnalyzer[] = [];
  private genericAnalyzer = new GenericAnalyzerV2();

  constructor() {
    this.analyzers = [
      new JavascriptAnalyzerV2(),
      new PythonAnalyzerV2(),
      new JavaAnalyzerV2(),
      new GoAnalyzerV2(),
      new RustAnalyzerV2(),
      new CSharpAnalyzerV2(),
      new CAnalyzerV2(),
      new PhpAnalyzerV2(),
      new RubyAnalyzerV2(),
      new KotlinAnalyzerV2(),
      new ShellAnalyzerV2()
    ];
  }

  /**
   * Indexes a source file with caching
   */
  indexFile(fileInfo: ScannedFileInfo, content: string, mtimeMs: number): IndexedSourceFile {
    const cached = this.cache.get<IndexedSourceFile>(fileInfo.relativePath, mtimeMs);
    if (cached) return cached;

    const firstLine = content.split(/\r?\n/)[0] || '';
    const lang = this.languageDetector.detectLanguage(fileInfo, firstLine);
    const indexed = this.astIndexer.indexSource(content, fileInfo.relativePath, lang);

    this.cache.set(fileInfo.relativePath, mtimeMs, '', indexed);
    return indexed;
  }

  /**
   * Dispatches reference analysis for a configuration key against a file
   */
  findReferencesForKey(
    key: string,
    fileInfo: ScannedFileInfo,
    content: string,
    mtimeMs: number = Date.now()
  ): UsageReference[] {
    const indexed = this.indexFile(fileInfo, content, mtimeMs);

    // 1. Try specialized language analyzer
    let specializedMatched = false;
    for (const analyzer of this.analyzers) {
      if (analyzer.canAnalyze(fileInfo)) {
        specializedMatched = true;
        const refs = analyzer.findConfigurationReferences(key, indexed, fileInfo);
        if (refs.length > 0) {
          return refs;
        }
      }
    }

    if (specializedMatched) {
      // Specialized analyzer analyzed the source file and determined no active references exist
      return [];
    }

    // 2. Fall back to generic structural analyzer (Level 7) ONLY for unsupported extensions/languages
    return this.genericAnalyzer.findConfigurationReferences(key, indexed, fileInfo);
  }

  /**
   * Invalidate cache for a file upon modification
   */
  invalidateFile(filePath: string): void {
    this.cache.invalidate(filePath);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
