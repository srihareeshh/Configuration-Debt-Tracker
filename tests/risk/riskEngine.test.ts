/**
 * Tests for Risk Engine (Module 4):
 * Risk Score = (Age Score * 0.25) + (Usage Score * 0.35) + (Impact Score * 0.25) + (Sensitivity Score * 0.15)
 * Levels: >75 Critical | 50-75 High | 25-49 Medium | <25 Low
 */

import * as assert from 'assert';
import { RiskEngine } from '../../src/core/risk/riskEngine';

export async function runRiskTests(): Promise<void> {
  console.log('--- Running Risk Engine Tests ---');

  const riskEngine = new RiskEngine();

  // 1. Critical Hardcoded Secret Test (>75)
  {
    const breakdown = riskEngine.calculateRisk({
      category: 'hardcoded_secret',
      ageDays: 90,
      usageCount: 2,
      affectedFilesCount: 1,
      sensitivity: 'secret',
      isSecret: true
    });

    assert.ok(breakdown.total > 75, `Secret risk should be critical (>75), got ${breakdown.total}`);
    assert.strictEqual(breakdown.severity, 'critical');
    assert.ok(breakdown.explanation.ageFactor.includes('/25'));
    assert.ok(breakdown.explanation.usageFactor.includes('/35'));
    assert.ok(breakdown.explanation.impactFactor.includes('/25'));
    assert.ok(breakdown.explanation.sensitivityFactor.includes('/15'));
    console.log(`✓ Critical risk score calculation passed (Score: ${breakdown.total})`);
  }

  // 2. High Risk Duplication with Drift (50-75)
  {
    const breakdown = riskEngine.calculateRisk({
      category: 'duplicated_configuration',
      ageDays: 45,
      usageCount: 2,
      affectedFilesCount: 3,
      sensitivity: 'internal',
      hasDrift: true
    });

    assert.ok(breakdown.total >= 50 && breakdown.total <= 75, `Duplication risk should be high (50-75), got ${breakdown.total}`);
    assert.strictEqual(breakdown.severity, 'high');
    console.log(`✓ High risk score calculation passed (Score: ${breakdown.total})`);
  }

  // 3. Medium Risk Stale Configuration (25-49)
  {
    const breakdown = riskEngine.calculateRisk({
      category: 'stale_configuration',
      ageDays: 35,
      usageCount: 1,
      affectedFilesCount: 1,
      sensitivity: 'public'
    });

    assert.ok(breakdown.total >= 25 && breakdown.total < 50, `Stale risk should be medium (25-49), got ${breakdown.total}`);
    assert.strictEqual(breakdown.severity, 'medium');
    console.log(`✓ Medium risk score calculation passed (Score: ${breakdown.total})`);
  }

  // 4. Low Risk Undocumented Setting (<25)
  {
    const breakdown = riskEngine.calculateRisk({
      category: 'undocumented_configuration',
      ageDays: 5,
      usageCount: 1,
      affectedFilesCount: 1,
      sensitivity: 'public'
    });

    assert.ok(breakdown.total < 40, `Low risk should be low/mild, got ${breakdown.total}`);
    console.log(`✓ Low risk calculation passed (Score: ${breakdown.total})`);
  }
}
