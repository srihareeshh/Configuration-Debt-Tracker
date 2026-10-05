/**
 * Configuration Debt Tracker - Risk Engine (Module 4)
 * Deterministic scoring formula:
 * Risk Score = (Age Score * 0.25) + (Usage Score * 0.35) + (Impact Score * 0.25) + (Sensitivity Score * 0.15)
 *
 * Severity thresholds:
 * > 75: Critical
 * 50 - 75: High
 * 25 - 49: Medium
 * < 25: Low
 */

import { SensitivityLevel } from '../../models/configuration';
import { DebtCategory } from '../../models/finding';
import { DEFAULT_RISK_WEIGHTS, RiskBreakdown, RiskWeights, Severity } from '../../models/risk';

export interface RiskInput {
  category: DebtCategory;
  ageDays: number;
  usageCount: number;
  affectedFilesCount: number;
  sensitivity: SensitivityLevel;
  isSecret?: boolean;
  hasDrift?: boolean;
  isLegacyNamed?: boolean;
}

export class RiskEngine {
  private weights: RiskWeights;

  constructor(weights: RiskWeights = DEFAULT_RISK_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Calculates explainable risk score and sub-score breakdown
   */
  calculateRisk(input: RiskInput): RiskBreakdown {
    // 1. Age Factor (0 - 100 scale, weighted by ageWeight)
    const rawAge = this.computeRawAgeScore(input);
    const ageScore = Math.round(rawAge * this.weights.ageWeight * 10) / 10;
    const maxAgeScore = Math.round(100 * this.weights.ageWeight);

    // 2. Usage Factor (0 - 100 scale, weighted by usageWeight)
    const rawUsage = this.computeRawUsageScore(input);
    const usageScore = Math.round(rawUsage * this.weights.usageWeight * 10) / 10;
    const maxUsageScore = Math.round(100 * this.weights.usageWeight);

    // 3. Impact Factor (0 - 100 scale, weighted by impactWeight)
    const rawImpact = this.computeRawImpactScore(input);
    const impactScore = Math.round(rawImpact * this.weights.impactWeight * 10) / 10;
    const maxImpactScore = Math.round(100 * this.weights.impactWeight);

    // 4. Sensitivity Factor (0 - 100 scale, weighted by sensitivityWeight)
    const rawSensitivity = this.computeRawSensitivityScore(input);
    const sensitivityScore = Math.round(rawSensitivity * this.weights.sensitivityWeight * 10) / 10;
    const maxSensitivityScore = Math.round(100 * this.weights.sensitivityWeight);

    // Total clamped between 0 and 100
    const rawTotal = ageScore + usageScore + impactScore + sensitivityScore;
    const total = Math.min(100, Math.max(0, Math.round(rawTotal)));

    const severity = this.classifySeverity(total);

    const explanation = {
      ageFactor: `${ageScore}/${maxAgeScore} (Age: ${input.ageDays} days)`,
      usageFactor: `${usageScore}/${maxUsageScore} (Usages: ${input.usageCount}, Cat: ${input.category})`,
      impactFactor: `${impactScore}/${maxImpactScore} (Affected files: ${input.affectedFilesCount})`,
      sensitivityFactor: `${sensitivityScore}/${maxSensitivityScore} (Level: ${input.sensitivity})`
    };

    return {
      ageScore,
      usageScore,
      impactScore,
      sensitivityScore,
      total,
      severity,
      explanation
    };
  }

  private computeRawAgeScore(input: RiskInput): number {
    if (input.isSecret) {
      // Secrets exposed for longer periods have much higher exposure risk
      if (input.ageDays > 60) return 95;
      if (input.ageDays > 14) return 80;
      return 65;
    }

    if (input.isLegacyNamed) {
      return 85;
    }

    if (input.ageDays >= 180) return 95;
    if (input.ageDays >= 90) return 80;
    if (input.ageDays >= 30) return 55;
    if (input.ageDays >= 7) return 30;
    return 20;
  }

  private computeRawUsageScore(input: RiskInput): number {
    switch (input.category) {
      case 'dead_configuration':
        // Dead configs with 0 usage carry maximum debt weight
        return 95;
      case 'hardcoded_secret':
        // Secret actively used in code has high runtime blast radius
        return input.usageCount > 0 ? 90 : 75;
      case 'duplicated_configuration':
        // Duplicated configs across multiple places carry high sync risk
        return Math.min(100, 50 + input.affectedFilesCount * 15);
      case 'stale_configuration':
        return input.usageCount === 0 ? 85 : 55;
      case 'undocumented_configuration':
        // Undocumented configuration with many usages confuses developers
        return Math.min(90, 30 + input.usageCount * 12);
      default:
        return 40;
    }
  }

  private computeRawImpactScore(input: RiskInput): number {
    if (input.isSecret) {
      return 95; // Secrets have severe security/compliance impact
    }
    if (input.hasDrift) {
      return 88; // Conflicting configuration values across files cause silent bugs
    }
    if (input.affectedFilesCount > 2) {
      return Math.min(90, 50 + input.affectedFilesCount * 10);
    }
    if (input.category === 'dead_configuration') {
      return 60;
    }
    return 40;
  }

  private computeRawSensitivityScore(input: RiskInput): number {
    switch (input.sensitivity) {
      case 'secret':
        return 100;
      case 'sensitive':
        return 75;
      case 'internal':
        return 40;
      case 'public':
      default:
        return 15;
    }
  }

  private classifySeverity(total: number): Severity {
    if (total > 75) {
      return 'critical';
    }
    if (total >= 50) {
      return 'high';
    }
    if (total >= 25) {
      return 'medium';
    }
    return 'low';
  }
}
