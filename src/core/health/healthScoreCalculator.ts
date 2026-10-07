/**
 * Configuration Debt Tracker - Configuration Health Score Calculator (Module 5)
 * Deterministic SCM Status Accounting Metric:
 * 100 Base Score with transparent deductions based on debt findings severity and volume.
 * Mathematically derived inventory counts with zero double-counting.
 */

import { ConfigurationItem } from '../../models/configuration';
import { DebtCategory, DebtFinding } from '../../models/finding';
import { HealthGrade, HealthScore, HealthScoreDeduction, ScanInventory } from '../../models/scan';
import { UsageAnalysis } from '../../models/usage';

export class HealthScoreCalculator {
  /**
   * Calculates deterministic Configuration Health Score from findings and inventory.
   */
  calculateHealthScore(
    items: ConfigurationItem[],
    findings: DebtFinding[],
    usageMap?: Record<string, UsageAnalysis>
  ): { healthScore: HealthScore; inventory: ScanInventory } {
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    const byCategory: Record<DebtCategory, number> = {
      dead_configuration: 0,
      duplicated_configuration: 0,
      configuration_drift: 0,
      stale_configuration: 0,
      hardcoded_secret: 0,
      undocumented_configuration: 0,
      suspicious_dynamic_reference: 0,
      environment_inconsistency: 0,
      unused_feature_flag: 0,
      high_impact_configuration: 0,
      test_only_configuration: 0,
      weak_evidence_configuration: 0
    };

    for (const f of findings) {
      if (byCategory[f.category] !== undefined) {
        byCategory[f.category]++;
      }

      switch (f.severity) {
        case 'critical':
          criticalCount++;
          break;
        case 'high':
          highCount++;
          break;
        case 'medium':
          mediumCount++;
          break;
        case 'low':
          lowCount++;
          break;
      }
    }

    // Deductions calculation
    const deductions: HealthScoreDeduction[] = [];
    let totalDeduction = 0;

    if (criticalCount > 0) {
      // 10 points per critical finding, max 45 points
      const deductionPoints = Math.min(45, criticalCount * 10);
      totalDeduction += deductionPoints;
      deductions.push({
        category: 'Critical Severity Debt',
        count: criticalCount,
        deductionPoints,
        explanation: `${criticalCount} critical finding(s) (secrets, active drift, severe dead configs) deducted ${deductionPoints} pts.`
      });
    }

    if (highCount > 0) {
      // 5 points per high finding, max 30 points
      const deductionPoints = Math.min(30, highCount * 5);
      totalDeduction += deductionPoints;
      deductions.push({
        category: 'High Severity Debt',
        count: highCount,
        deductionPoints,
        explanation: `${highCount} high severity finding(s) (cross-file duplication, stale flags) deducted ${deductionPoints} pts.`
      });
    }

    if (mediumCount > 0) {
      // 2 points per medium finding, max 15 points
      const deductionPoints = Math.min(15, mediumCount * 2);
      totalDeduction += deductionPoints;
      deductions.push({
        category: 'Medium Severity Debt',
        count: mediumCount,
        deductionPoints,
        explanation: `${mediumCount} medium severity finding(s) (undocumented keys, unreferenced settings) deducted ${deductionPoints} pts.`
      });
    }

    if (lowCount > 0) {
      // 0.5 points per low finding, max 10 points
      const deductionPoints = Math.min(10, Math.round(lowCount * 0.5));
      totalDeduction += deductionPoints;
      deductions.push({
        category: 'Low Severity Debt',
        count: lowCount,
        deductionPoints,
        explanation: `${lowCount} low severity finding(s) deducted ${deductionPoints} pts.`
      });
    }

    const baseScore = 100;
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore - totalDeduction)));
    const grade = this.computeGrade(finalScore);

    // Compute inventory metrics directly from actual configuration items and usage analysis
    const totalItems = items.length;

    let usedItems = 0;
    if (usageMap) {
      // Directly count items whose key has verified usages
      usedItems = items.filter((item) => {
        const u = usageMap[item.key];
        return u && u.isUsed;
      }).length;
    } else {
      // Fallback: derive from dead_configuration findings
      const deadCount = byCategory.dead_configuration + byCategory.unused_feature_flag;
      usedItems = Math.max(0, totalItems - deadCount);
    }

    const unusedItems = Math.max(0, totalItems - usedItems);
    const duplicateItems = byCategory.duplicated_configuration;
    const driftItems = byCategory.configuration_drift;
    const secretItems = items.filter((i) => i.isPotentialSecret).length;
    const undocumentedItems = items.filter((i) => !i.documentation).length;

    const byFormat = {
      env: 0,
      yaml: 0,
      json: 0,
      xml: 0,
      dockerfile: 0,
      kubernetes: 0,
      toml: 0,
      properties: 0
    };
    for (const item of items) {
      if (byFormat[item.format] !== undefined) {
        byFormat[item.format]++;
      }
    }

    const inventory: ScanInventory = {
      totalItems,
      usedItems,
      unusedItems,
      duplicateItems,
      driftItems,
      secretItems,
      undocumentedItems,
      byFormat,
      bySeverity: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount
      },
      byCategory
    };

    const summary = `${grade} Configuration Health (${finalScore}/100) with ${findings.length} configuration debt finding(s) across ${totalItems} tracked item(s).`;

    return {
      healthScore: {
        score: finalScore,
        grade,
        baseScore,
        deductions,
        summary
      },
      inventory
    };
  }

  private computeGrade(score: number): HealthGrade {
    if (score >= 80) return 'Healthy';
    if (score >= 65) return 'Moderate';
    if (score >= 45) return 'Degraded';
    return 'Critical';
  }
}
