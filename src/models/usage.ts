/**
 * Configuration Debt Tracker - Source Code Usage Analysis Models
 * Represents deterministic static analysis references and 7-tier confidence metrics.
 */

export type UsageType =
  | 'exact'       // Exact direct API reference (Level 1, 2, 3)
  | 'normalized'  // Key variant match (Level 4)
  | 'dataflow'    // Local variable propagation (Level 5)
  | 'dynamic'     // Possible dynamic reference (Level 6)
  | 'generic'     // Generic text match fallback (Level 7)
  | 'none';

export type ReferenceConfidenceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ConfidenceTierInfo {
  level: ReferenceConfidenceLevel;
  name: string;
  minConfidence: number;
  maxConfidence: number;
  description: string;
}

export const CONFIDENCE_TIERS: Record<ReferenceConfidenceLevel, ConfidenceTierInfo> = {
  1: { level: 1, name: 'Exact Static Property', minConfidence: 98, maxConfidence: 100, description: 'Direct static property access (e.g. process.env.DATABASE_URL)' },
  2: { level: 2, name: 'Exact Index Access', minConfidence: 97, maxConfidence: 99, description: 'Direct string indexed access (e.g. process.env["DATABASE_URL"])' },
  3: { level: 3, name: 'Framework Config Access', minConfidence: 90, maxConfidence: 98, description: 'Standard framework or library helper (e.g. os.getenv("DATABASE_URL"), @Value("${database.url}"))' },
  4: { level: 4, name: 'Normalized Key Match', minConfidence: 70, maxConfidence: 90, description: 'Logical canonical variant (e.g. DATABASE_URL <-> database.url <-> databaseUrl)' },
  5: { level: 5, name: 'Variable Dataflow Propagation', minConfidence: 70, maxConfidence: 85, description: 'Statically resolvable variable or constant propagation' },
  6: { level: 6, name: 'Dynamic Key Construction', minConfidence: 50, maxConfidence: 70, description: 'Possible dynamic concatenation or expression (marked as Possible Usage)' },
  7: { level: 7, name: 'Generic Text Fallback', minConfidence: 40, maxConfidence: 60, description: 'Low-confidence contextual word-boundary match (never definite usage)' }
};

export type SupportedSourceLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'kotlin'
  | 'shell'
  | 'powershell'
  | 'generic';

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'method' | 'class' | 'interface' | 'variable' | 'module';
  containerName?: string;
  startLine: number;
  endLine: number;
  filePath: string;
}

export interface UsageReference {
  filePath: string;
  absoluteFilePath: string;
  line: number;
  column: number;
  snippet: string;
  language: SupportedSourceLanguage;
  usageType: UsageType;
  confidence: number; // 0-100%
  confidenceLevel: ReferenceConfidenceLevel;
  patternMatched: string;
  enclosingSymbol?: SymbolInfo;
  isTestFile?: boolean;
}

export interface UsageAnalysis {
  key: string;
  isUsed: boolean;
  confidence: number; // 0-100%
  highestConfidenceLevel?: ReferenceConfidenceLevel;
  statusText: 'Used' | 'Possible usage' | 'Unused';
  referenceCount: number;
  references: UsageReference[];
  referencingFiles: string[];
  isTestOnly?: boolean;
}
