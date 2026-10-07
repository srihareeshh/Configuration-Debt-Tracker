/**
 * Tests for CleanupService and HistoryService (Modules 6 & 7)
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DebtFinding } from '../../src/models/finding';
import { ScanResult } from '../../src/models/scan';
import { CleanupService } from '../../src/services/cleanupService';
import { HistoryService } from '../../src/services/historyService';

export async function runServicesTests(): Promise<void> {
  console.log('--- Running Services Tests (Backlog & History) ---');

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'config-debt-test-'));

  try {
    // 1. Cleanup Backlog Tests
    const cleanupService = new CleanupService(tmpDir);
    const mockFinding: DebtFinding = {
      id: 'finding-001',
      title: 'Unused OLD_API_KEY',
      category: 'dead_configuration',
      categoryLabel: 'Dead Configuration',
      severity: 'critical',
      riskScore: 82,
      riskBreakdown: {} as any,
      configurationItem: {
        id: '.env:1:OLD_API_KEY', key: 'OLD_API_KEY', value: 'key', maskedValue: 'key',
        filePath: '.env', absoluteFilePath: path.join(tmpDir, '.env'), line: 1,
        format: 'env', type: 'env-var', sensitivity: 'secret', isPotentialSecret: true
      },
      confidence: 97,
      evidence: ['No source references found.'],
      affectedFiles: ['.env'],
      recommendation: 'Remove it',
      suggestedAction: 'Remove OLD_API_KEY'
    };

    const backlog = await cleanupService.generateCleanupBacklog([mockFinding]);
    assert.strictEqual(backlog.length, 1);
    assert.strictEqual(backlog[0].status, 'open', 'Initial status should be open');
    assert.strictEqual(backlog[0].priority, 1);

    // Update status to 'needs_review'
    await cleanupService.updateStatus('finding-001', 'needs_review', 'Checked with auth team');
    const updatedBacklog = await cleanupService.generateCleanupBacklog([mockFinding]);
    assert.strictEqual(updatedBacklog[0].status, 'needs_review');
    assert.strictEqual(updatedBacklog[0].statusNotes, 'Checked with auth team');

    // Update status to 'resolved'
    await cleanupService.updateStatus('finding-001', 'resolved');
    const resolvedBacklog = await cleanupService.generateCleanupBacklog([mockFinding]);
    assert.strictEqual(resolvedBacklog[0].status, 'resolved');
    console.log('✓ CleanupService status lifecycle passed');

    // 2. History Tracking Tests
    const historyService = new HistoryService(tmpDir);
    const emptyHistory = await historyService.getHistory();
    assert.strictEqual(emptyHistory.length, 0, 'History should start empty');

    const scanResult1: ScanResult = {
      scanId: 'scan-1',
      workspaceName: 'test-ws',
      workspacePath: tmpDir,
      timestamp: Date.now() - 60000,
      healthScore: { score: 71, grade: 'Moderate', baseScore: 100, deductions: [], summary: '' },
      inventory: { totalItems: 10, usedItems: 6, unusedItems: 4, duplicateItems: 0, driftItems: 0, secretItems: 0, undocumentedItems: 0, byFormat: {} as any, bySeverity: { critical: 2, high: 2, medium: 0, low: 0 }, byCategory: {} as any },
      findings: [mockFinding],
      items: [],
      usageMap: {},
      cleanupItems: [],
      scanDurationMs: 120,
      errors: []
    };

    const entry1 = await historyService.recordScan(scanResult1);
    assert.strictEqual(entry1.healthScore, 71);
    assert.strictEqual(entry1.deltaFromPrevious, undefined);

    const scanResult2: ScanResult = {
      ...scanResult1,
      scanId: 'scan-2',
      timestamp: Date.now(),
      healthScore: { score: 82, grade: 'Healthy', baseScore: 100, deductions: [], summary: '' }
    };

    const entry2 = await historyService.recordScan(scanResult2);
    assert.strictEqual(entry2.healthScore, 82);
    assert.strictEqual(entry2.deltaFromPrevious, 11, 'Delta from previous scan should be +11');

    const finalHistory = await historyService.getHistory();
    assert.strictEqual(finalHistory.length, 2);

    await historyService.clearHistory();
    const cleared = await historyService.getHistory();
    assert.strictEqual(cleared.length, 0, 'History should be cleared');
    console.log('✓ HistoryService tracking and delta calculation passed');
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}
