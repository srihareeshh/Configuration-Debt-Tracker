/**
 * Integration Pipeline Tests:
 * 1. Empty workspace handling
 * 2. Malformed configuration file resilience
 * 3. End-to-end scan pipeline execution
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ScanService } from '../../src/services/scanService';

export async function runIntegrationTests(): Promise<void> {
  console.log('--- Running Integration Pipeline Tests ---');

  const scanService = new ScanService();

  // Test 1: Empty Workspace
  {
    const emptyDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'config-debt-empty-'));
    try {
      const result = await scanService.runScan(emptyDir);
      assert.strictEqual(result.items.length, 0, 'Empty workspace should have 0 items');
      assert.strictEqual(result.findings.length, 0, 'Empty workspace should have 0 findings');
      assert.strictEqual(result.healthScore.score, 100, 'Empty workspace should have 100 health score');
      console.log('✓ Empty workspace test passed');
    } finally {
      await fs.promises.rm(emptyDir, { recursive: true, force: true });
    }
  }

  // Test 2: Malformed configuration files
  {
    const malformedDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'config-debt-malformed-'));
    try {
      // Create broken YAML
      await fs.promises.writeFile(
        path.join(malformedDir, 'bad.yml'),
        'key: value\n  invalid: indent: error: [[\n',
        'utf-8'
      );
      // Create broken JSON
      await fs.promises.writeFile(
        path.join(malformedDir, 'bad.json'),
        '{ "unclosed": "string ...\n',
        'utf-8'
      );
      // Create a valid .env alongside
      await fs.promises.writeFile(
        path.join(malformedDir, '.env'),
        'VALID_VAR=hello\n',
        'utf-8'
      );

      const result = await scanService.runScan(malformedDir);
      assert.ok(result.items.length >= 1, 'Scanner should still parse valid files despite malformed files');
      assert.ok(result.items.some((i) => i.key === 'VALID_VAR'));
      console.log('✓ Malformed configuration file resilience test passed');
    } finally {
      await fs.promises.rm(malformedDir, { recursive: true, force: true });
    }
  }

  // Test 3: Full End-to-End Pipeline
  {
    const wsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'config-debt-e2e-'));
    try {
      // 1. Config files
      await fs.promises.writeFile(
        path.join(wsDir, '.env'),
        `
# Active DB
DATABASE_URL=postgres://localhost:5432/db
# Unused legacy key
OLD_API_URL=https://v1.legacy.com
# Hardcoded secret
STRIPE_KEY=mock_live_stripe_123456789012345678901234
# Duplicated setting
API_TIMEOUT=5000
`
      );

      await fs.promises.writeFile(
        path.join(wsDir, 'application.yml'),
        `
api:
  timeout: 5000
`
      );

      // 2. Source code files
      const srcDir = path.join(wsDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(srcDir, 'config.ts'),
        `
export const db = process.env.DATABASE_URL;
`
      );

      const result = await scanService.runScan(wsDir);
      assert.ok(result.items.length >= 4, 'Should extract items from .env and application.yml');

      // Verify DATABASE_URL is used
      assert.strictEqual(result.usageMap['DATABASE_URL'].isUsed, true);
      assert.strictEqual(result.usageMap['DATABASE_URL'].statusText, 'Used');

      // Verify OLD_API_URL is dead
      assert.strictEqual(result.usageMap['OLD_API_URL'].isUsed, false);
      assert.strictEqual(result.usageMap['OLD_API_URL'].statusText, 'Unused');

      // Verify findings
      assert.ok(result.findings.some((f) => f.category === 'dead_configuration' && f.configurationItem.key === 'OLD_API_URL'));
      assert.ok(result.findings.some((f) => f.category === 'hardcoded_secret' && f.configurationItem.key === 'STRIPE_KEY'));

      // Verify health score
      assert.ok(result.healthScore.score < 100, 'Health score should reflect debt deductions');
      assert.ok(result.cleanupItems.length >= 2, 'Cleanup backlog should be populated');
      console.log(`✓ Full End-to-End Scan Pipeline test passed (Score: ${result.healthScore.score}/100)`);
    } finally {
      await fs.promises.rm(wsDir, { recursive: true, force: true });
    }
  }
}
