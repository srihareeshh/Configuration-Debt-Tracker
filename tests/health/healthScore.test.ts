/**
 * Tests for Configuration Health Score Calculator (Module 5)
 */

import * as assert from 'assert';
import { HealthScoreCalculator } from '../../src/core/health/healthScoreCalculator';
import { ConfigurationItem } from '../../src/models/configuration';
import { DebtFinding } from '../../src/models/finding';

export async function runHealthScoreTests(): Promise<void> {
  console.log('--- Running Health Score Calculator Tests ---');

  const calculator = new HealthScoreCalculator();

  // Test 1: Pristine clean repository (Health = 100, Healthy)
  {
    const items: ConfigurationItem[] = [
      {
        id: '1', key: 'DB_URL', value: 'pg', maskedValue: 'pg', filePath: '.env',
        absoluteFilePath: '/mock/.env', line: 1, format: 'env', type: 'env-var',
        sensitivity: 'public', isPotentialSecret: false
      }
    ];
    const { healthScore, inventory } = calculator.calculateHealthScore(items, []);
    assert.strictEqual(healthScore.score, 100, 'Score should be 100 when there are no findings');
    assert.strictEqual(healthScore.grade, 'Healthy');
    assert.strictEqual(inventory.usedItems, 1);
    assert.strictEqual(inventory.unusedItems, 0);
    console.log('✓ Clean repo health score (100) passed');
  }

  // Test 2: Repository with critical and high findings
  {
    const items: ConfigurationItem[] = [
      { id: '1', key: 'K1', value: 'v', maskedValue: 'v', filePath: '.env', absoluteFilePath: '/m/.env', line: 1, format: 'env', type: 'env-var', sensitivity: 'secret', isPotentialSecret: true },
      { id: '2', key: 'K2', value: 'v', maskedValue: 'v', filePath: '.env', absoluteFilePath: '/m/.env', line: 2, format: 'env', type: 'env-var', sensitivity: 'public', isPotentialSecret: false },
      { id: '3', key: 'K3', value: 'v', maskedValue: 'v', filePath: '.env', absoluteFilePath: '/m/.env', line: 3, format: 'env', type: 'env-var', sensitivity: 'public', isPotentialSecret: false }
    ];

    const findings: DebtFinding[] = [
      {
        id: 'f1', title: 'Hardcoded secret', category: 'hardcoded_secret', categoryLabel: 'Hardcoded Secret',
        severity: 'critical', riskScore: 88,
        riskBreakdown: { ageScore: 20, usageScore: 30, impactScore: 24, sensitivityScore: 14, total: 88, severity: 'critical', explanation: {} as any },
        configurationItem: items[0], confidence: 99, evidence: ['Evidence 1'], affectedFiles: ['.env'],
        recommendation: 'Fix', suggestedAction: 'Action'
      },
      {
        id: 'f2', title: 'Duplicated config', category: 'duplicated_configuration', categoryLabel: 'Duplicated Configuration',
        severity: 'high', riskScore: 68,
        riskBreakdown: { ageScore: 18, usageScore: 22, impactScore: 18, sensitivityScore: 10, total: 68, severity: 'high', explanation: {} as any },
        configurationItem: items[1], confidence: 95, evidence: ['Evidence 2'], affectedFiles: ['.env', 'app.yml'],
        recommendation: 'Fix', suggestedAction: 'Action'
      }
    ];

    const { healthScore, inventory } = calculator.calculateHealthScore(items, findings);
    // 100 - (10 for critical) - (5 for high) = 85
    assert.strictEqual(healthScore.score, 85);
    assert.strictEqual(healthScore.grade, 'Healthy');
    assert.strictEqual(inventory.bySeverity.critical, 1);
    assert.strictEqual(inventory.bySeverity.high, 1);
    assert.ok(healthScore.deductions.length >= 2, 'Should detail deductions');
    console.log(`✓ Deductions calculation passed (Score: ${healthScore.score})`);
  }
}
