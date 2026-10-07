/**
 * Configuration Debt Tracker - Scan Results, Health Score, Impact & History Models
 * Maps directly to SCM Status Accounting and Configuration Control
 */

import { ConfigurationFormat, ConfigurationItem } from './configuration';
import { DebtCategory, DebtFinding } from './finding';
import { Severity } from './risk';
import { UsageAnalysis } from './usage';

export type HealthGrade = 'Healthy' | 'Moderate' | 'Degraded' | 'Critical';

export interface HealthScoreDeduction {
  category: string;
  count: number;
  deductionPoints: number;
  explanation: string;
}

export interface HealthScore {
  score: number; // 0 - 100 (Higher is healthier)
  grade: HealthGrade;
  baseScore: number;
  deductions: HealthScoreDeduction[];
  summary: string;
}

export interface ScanInventory {
  totalItems: number;
  usedItems: number;
  unusedItems: number;
  duplicateItems: number;
  driftItems: number;
  secretItems: number;
  undocumentedItems: number;
  byFormat: Record<ConfigurationFormat, number>;
  bySeverity: Record<Severity, number>;
  byCategory: Record<DebtCategory, number>;
}

export type CleanupStatus = 'open' | 'needs_review' | 'resolved' | 'ignored';

export interface CleanupItem {
  id: string;
  findingId: string;
  priority: number; // 1 (Highest priority) to N
  riskScore: number;
  severity: Severity;
  category: string;
  key: string;
  file: string;
  line: number;
  evidence: string;
  suggestedAction: string;
  status: CleanupStatus;
  statusNotes?: string;
  updatedAt: number;
}

export interface ScanHistoryEntry {
  scanId: string;
  timestamp: number;
  formattedDate: string;
  healthScore: number;
  totalItems: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  deltaFromPrevious?: number;
}

export interface ImpactAnalysisResult {
  configurationKey: string;
  declaredLocations: { file: string; line: number; format: ConfigurationFormat }[];
  staticReferenceCount: number;
  affectedFilesCount: number;
  affectedFiles: string[];
  affectedSymbols: { name: string; kind: string; file: string; line: number }[];
  staticDependencyEvidence: { file: string; line: number; snippet: string; confidence: number }[];
  confidence: number;
  impactLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  blindSpots: string[];
  removalAdvisory: string;
}

export interface ScanResult {
  scanId: string;
  workspaceName: string;
  workspacePath: string;
  timestamp: number;
  healthScore: HealthScore;
  inventory: ScanInventory;
  findings: DebtFinding[];
  items: ConfigurationItem[];
  usageMap: Record<string, UsageAnalysis>;
  cleanupItems: CleanupItem[];
  scanDurationMs: number;
  errors: { file: string; message: string }[];
}
