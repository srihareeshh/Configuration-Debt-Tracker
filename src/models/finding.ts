/**
 * Configuration Debt Tracker - Debt Findings Models
 * Represents detected configuration debt across the 12 comprehensive categories
 */

import { ConfigurationItem } from './configuration';
import { RiskBreakdown, Severity } from './risk';

export type DebtCategory =
  | 'dead_configuration'
  | 'duplicated_configuration'
  | 'configuration_drift'
  | 'stale_configuration'
  | 'hardcoded_secret'
  | 'undocumented_configuration'
  | 'suspicious_dynamic_reference'
  | 'environment_inconsistency'
  | 'unused_feature_flag'
  | 'high_impact_configuration'
  | 'test_only_configuration'
  | 'weak_evidence_configuration';

export interface DependencyEvidenceItem {
  file: string;
  line: number;
  symbol?: string;
  snippet?: string;
  confidence: number;
}

export interface RemediationProposal {
  filePath: string;
  line: number;
  originalText: string;
  proposedDiff: string;
  explanation: string;
  actionType: 'delete_declaration' | 'mask_secret' | 'consolidate_duplicate' | 'add_documentation';
}

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
  blindSpots?: string[];
  dependencyEvidence?: DependencyEvidenceItem[];
  remediationProposal?: RemediationProposal;
  duplicateLocations?: { filePath: string; line: number; valueMatch: boolean; value?: string }[];
  secretDetectionType?: string;
  ageDays?: number;
}
