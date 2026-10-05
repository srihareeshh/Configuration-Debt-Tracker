/**
 * Configuration Debt Tracker - Scan Results, Health Score & History Models
 * Maps directly to SCM Status Accounting and Configuration Control
 */

import { ConfigurationFormat, ConfigurationItem } from './configuration';
import { DebtFinding } from './finding';
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
  secretItems: number;
  undocumentedItems: number;
  byFormat: Record<ConfigurationFormat, number>;
  bySeverity: Record<Severity, number>;
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
