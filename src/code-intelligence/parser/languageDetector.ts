/**
 * Configuration Debt Tracker - Language Detector
 * Detects programming languages accurately from file extensions, names, and shebangs.
 */

import { SupportedSourceLanguage } from '../../models/usage';
import { ScannedFileInfo } from '../../utils/fileUtils';

const EXTENSION_MAP: Record<string, SupportedSourceLanguage> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.pyw': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.psm1': 'powershell'
};

export class LanguageDetector {
  /**
   * Detects language for a scanned file
   */
  detectLanguage(fileInfo: ScannedFileInfo, firstLine?: string): SupportedSourceLanguage {
    const ext = fileInfo.extension.toLowerCase();
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }

    // Check shebang if available
    if (firstLine && firstLine.startsWith('#!')) {
      const lower = firstLine.toLowerCase();
      if (lower.includes('python')) return 'python';
      if (lower.includes('node') || lower.includes('deno') || lower.includes('bun')) return 'javascript';
      if (lower.includes('bash') || lower.includes('/sh') || lower.includes('zsh')) return 'shell';
      if (lower.includes('ruby')) return 'ruby';
      if (lower.includes('php')) return 'php';
      if (lower.includes('pwsh') || lower.includes('powershell')) return 'powershell';
    }

    return 'generic';
  }

  /**
   * Returns supported extensions for all specialized languages
   */
  getAllSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_MAP);
  }
}
