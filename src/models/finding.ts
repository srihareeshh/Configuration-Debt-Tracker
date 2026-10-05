/**
 * Configuration Debt Tracker - Debt Findings Models
 * Represents detected configuration debt across the 5 core categories
 */

import { ConfigurationItem } from './configuration';
import { RiskBreakdown, Severity } from './risk';

export type DebtCategory =
  | 'dead_configuration'
  | 'duplicated_configuration'
  | 'stale_configuration'
  | 'hardcoded_secret'
  | 'undocumented_configuration';

export interface DebtFinding {
  id: string;
  title: string;
  category: DebtCategory;
  categoryLabel: string;
  severity: Severity;
  riskScore: number;
  riskBreakdown: RiskBreakdown;
  configurationItem: ConfigurationItem;
  confidence: number; // 0-100%
  evidence: string[];
  affectedFiles: string[];
  recommendation: string;
  suggestedAction: string;
  duplicateLocations?: { filePath: string; line: number; valueMatch: boolean }[];
  secretDetectionType?: string;
  ageDays?: number;
}
