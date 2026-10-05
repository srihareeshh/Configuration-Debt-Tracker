/**
 * Configuration Debt Tracker - Risk Scoring Models
 * Deterministic formula:
 * Risk Score = (Age Score * 0.25) + (Usage Score * 0.35) + (Impact Score * 0.25) + (Sensitivity Score * 0.15)
 * Levels: >75 Critical | 50-75 High | 25-49 Medium | <25 Low
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface RiskBreakdown {
  ageScore: number;         // 0 - 25
  usageScore: number;       // 0 - 35
  impactScore: number;      // 0 - 25
  sensitivityScore: number; // 0 - 15
  total: number;            // 0 - 100
  severity: Severity;
  explanation: {
    ageFactor: string;
    usageFactor: string;
    impactFactor: string;
    sensitivityFactor: string;
  };
}

export interface RiskWeights {
  ageWeight: number;        // default 0.25
  usageWeight: number;      // default 0.35
  impactWeight: number;     // default 0.25
  sensitivityWeight: number;// default 0.15
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  ageWeight: 0.25,
  usageWeight: 0.35,
  impactWeight: 0.25,
  sensitivityWeight: 0.15
};
