/**
 * Configuration Debt Tracker - Source Code Usage Analysis Models
 * Represents deterministic static analysis references and confidence metrics
 */

export type UsageType =
  | 'exact'       // Exact direct API reference (e.g. process.env.API_KEY, os.getenv("API_KEY"))
  | 'normalized'  // Key variant match (e.g. database.url <-> DATABASE_URL, camelCase vs SNAKE_CASE)
  | 'dynamic'     // Possible dynamic reference (e.g. template string, computed index, reflection)
  | 'none';

export type SupportedSourceLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'generic';

export interface UsageReference {
  filePath: string;
  absoluteFilePath: string;
  line: number;
  column: number;
  snippet: string;
  language: SupportedSourceLanguage;
  usageType: UsageType;
  confidence: number; // 0-100%
  patternMatched: string;
}

export interface UsageAnalysis {
  key: string;
  isUsed: boolean;
  confidence: number; // 0-100%
  statusText: 'Used' | 'Possible usage' | 'Unused';
  referenceCount: number;
  references: UsageReference[];
  referencingFiles: string[];
}
