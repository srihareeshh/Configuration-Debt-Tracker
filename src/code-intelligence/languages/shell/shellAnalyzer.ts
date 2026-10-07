/**
 * Configuration Debt Tracker - Shell & PowerShell Analyzer
 * Supports .sh, .bash, .zsh, .ps1, .psm1.
 * Recognizes $KEY, ${KEY}, $env:KEY.
 */

import { SupportedSourceLanguage, UsageReference } from '../../../models/usage';
import { ScannedFileInfo } from '../../../utils/fileUtils';
import { IndexedSourceFile } from '../../ast/astIndexer';
import { AbstractLanguageAnalyzer } from '../baseAnalyzer';

export class ShellAnalyzerV2 extends AbstractLanguageAnalyzer {
  readonly languageId: SupportedSourceLanguage = 'shell';
  readonly extensions = ['.sh', '.bash', '.zsh', '.ps1', '.psm1'];

  findConfigurationReferences(
    key: string,
    indexedFile: IndexedSourceFile,
    fileInfo: ScannedFileInfo
  ): UsageReference[] {
    const isPwsh = fileInfo.extension.toLowerCase().startsWith('.ps');
    const lang = isPwsh ? 'powershell' : 'shell';
    return this.matchCatalogPatterns(key, indexedFile, fileInfo, lang);
  }
}
