/**
 * Tests for Debt Detector (Module 3):
 * 1. Used environment variable
 * 2. Unused environment variable (Dead configuration)
 * 3. Duplicate configuration (multi-file with drift)
 * 4. Hardcoded secret detection
 * 5. Stale / legacy configuration detection
 * 6. Undocumented configuration detection
 */

import * as assert from 'assert';
import { DebtDetector } from '../../src/core/detector/debtDetector';
import { ConfigurationItem } from '../../src/models/configuration';
import { UsageAnalysis } from '../../src/models/usage';

export async function runDetectorTests(): Promise<void> {
  console.log('--- Running Debt Detector Tests ---');

  const detector = new DebtDetector();

  // Test 1 & 2: Used vs Unused Environment Variable
  {
    const items: ConfigurationItem[] = [
      {
        id: '.env:1:ACTIVE_DB_URL',
        key: 'ACTIVE_DB_URL',
        value: 'postgres://localhost:5432/app',
        maskedValue: 'postgres://localhost:5432/app',
        filePath: '.env',
        absoluteFilePath: '/mock/.env',
        line: 1,
        format: 'env',
        type: 'env-var',
        sensitivity: 'public',
        ageDays: 10,
        isPotentialSecret: false
      },
      {
        id: '.env:5:OLD_API_URL',
        key: 'OLD_API_URL',
        value: 'https://v1.api.legacy.com',
        maskedValue: 'https://v1.api.legacy.com',
        filePath: '.env',
        absoluteFilePath: '/mock/.env',
        line: 5,
        format: 'env',
        type: 'env-var',
        sensitivity: 'public',
        ageDays: 120,
        isPotentialSecret: false
      }
    ];

    const usageMap: Record<string, UsageAnalysis> = {
      ACTIVE_DB_URL: {
        key: 'ACTIVE_DB_URL',
        isUsed: true,
        confidence: 98,
        statusText: 'Used',
        referenceCount: 3,
        references: [],
        referencingFiles: ['src/db.ts', 'src/server.ts']
      },
      OLD_API_URL: {
        key: 'OLD_API_URL',
        isUsed: false,
        confidence: 0,
        statusText: 'Unused',
        referenceCount: 0,
        references: [],
        referencingFiles: []
      }
    };

    const findings = detector.detectDebt(items, usageMap);

    // ACTIVE_DB_URL should NOT be flagged as dead
    const deadActive = findings.find((f) => f.configurationItem.key === 'ACTIVE_DB_URL' && f.category === 'dead_configuration');
    assert.strictEqual(deadActive, undefined, 'Active configuration must not be flagged as dead');

    // OLD_API_URL SHOULD be flagged as dead
    const deadOld = findings.find((f) => f.configurationItem.key === 'OLD_API_URL' && f.category === 'dead_configuration');
    assert.ok(deadOld, 'Unused configuration OLD_API_URL must be flagged as dead');
    assert.strictEqual(deadOld?.category, 'dead_configuration');
    console.log('✓ Used vs Unused detection passed');
  }

  // Test 3: Duplicated Configuration across multiple files
  {
    const items: ConfigurationItem[] = [
      {
        id: '.env:2:API_TIMEOUT',
        key: 'API_TIMEOUT',
        value: '5000',
        maskedValue: '5000',
        filePath: '.env',
        absoluteFilePath: '/mock/.env',
        line: 2,
        format: 'env',
        type: 'env-var',
        sensitivity: 'public',
        ageDays: 20,
        isPotentialSecret: false
      },
      {
        id: 'application.yml:4:API_TIMEOUT',
        key: 'API_TIMEOUT',
        value: '10000', // Value drift!
        maskedValue: '10000',
        filePath: 'application.yml',
        absoluteFilePath: '/mock/application.yml',
        line: 4,
        format: 'yaml',
        type: 'yaml-property',
        sensitivity: 'public',
        ageDays: 20,
        isPotentialSecret: false
      }
    ];

    const usageMap: Record<string, UsageAnalysis> = {
      API_TIMEOUT: {
        key: 'API_TIMEOUT',
        isUsed: true,
        confidence: 95,
        statusText: 'Used',
        referenceCount: 1,
        references: [],
        referencingFiles: ['src/client.ts']
      }
    };

    const findings = detector.detectDebt(items, usageMap);
    const dupFinding = findings.find((f) => f.category === 'duplicated_configuration');
    assert.ok(dupFinding, 'Duplicate finding must be generated');
    assert.strictEqual(dupFinding?.affectedFiles.length, 2, 'Should detect 2 affected files');
    assert.ok(dupFinding?.evidence.some((e) => e.includes('DRIFT')), 'Should detect value drift between 5000 and 10000');
    console.log('✓ Duplicated configuration and drift detection passed');
  }

  // Test 4: Hardcoded Secret Detection
  {
    const secretItem: ConfigurationItem = {
      id: '.env:10:STRIPE_SECRET',
      key: 'STRIPE_SECRET',
      value: '••••••••',
      maskedValue: 'sk_live_••••••••••••',
      filePath: '.env',
      absoluteFilePath: '/mock/.env',
      line: 10,
      format: 'env',
      type: 'env-var',
      sensitivity: 'secret',
      ageDays: 45,
      isPotentialSecret: true,
      secretType: 'Stripe Live Secret Key'
    };

    const usageMap: Record<string, UsageAnalysis> = {
      STRIPE_SECRET: {
        key: 'STRIPE_SECRET',
        isUsed: true,
        confidence: 98,
        statusText: 'Used',
        referenceCount: 1,
        references: [],
        referencingFiles: ['src/payments.ts']
      }
    };

    const findings = detector.detectDebt([secretItem], usageMap);
    const secretFinding = findings.find((f) => f.category === 'hardcoded_secret');
    assert.ok(secretFinding, 'Hardcoded secret finding must be generated');
    assert.strictEqual(secretFinding?.severity, 'critical', 'Plaintext secret should be critical severity');
    console.log('✓ Hardcoded secret detection passed');
  }

  // Test 5: Outdated / Stale Feature Flag Detection
  {
    const staleItem: ConfigurationItem = {
      id: '.env:8:FEATURE_LEGACY_LOGIN',
      key: 'FEATURE_LEGACY_LOGIN',
      value: 'true',
      maskedValue: 'true',
      filePath: '.env',
      absoluteFilePath: '/mock/.env',
      line: 8,
      format: 'env',
      type: 'env-var',
      sensitivity: 'public',
      ageDays: 140,
      isPotentialSecret: false
    };

    const usageMap: Record<string, UsageAnalysis> = {
      FEATURE_LEGACY_LOGIN: {
        key: 'FEATURE_LEGACY_LOGIN',
        isUsed: true,
        confidence: 90,
        statusText: 'Used',
        referenceCount: 1,
        references: [],
        referencingFiles: ['src/auth.ts']
      }
    };

    const findings = detector.detectDebt([staleItem], usageMap);
    const staleFinding = findings.find((f) => f.category === 'stale_configuration');
    assert.ok(staleFinding, 'Stale legacy flag must be detected');
    console.log('✓ Stale feature flag detection passed');
  }

  // Test 6: Undocumented Configuration Detection
  {
    const undocItem: ConfigurationItem = {
      id: 'config.json:4:INTERNAL_ROUTING_KEY',
      key: 'INTERNAL_ROUTING_KEY',
      value: 'route-99',
      maskedValue: 'route-99',
      filePath: 'config.json',
      absoluteFilePath: '/mock/config.json',
      line: 4,
      format: 'json',
      type: 'json-property',
      sensitivity: 'internal',
      documentation: undefined, // Missing docs
      ageDays: 10,
      isPotentialSecret: false
    };

    const usageMap: Record<string, UsageAnalysis> = {
      INTERNAL_ROUTING_KEY: {
        key: 'INTERNAL_ROUTING_KEY',
        isUsed: true,
        confidence: 95,
        statusText: 'Used',
        referenceCount: 3,
        references: [],
        referencingFiles: ['src/router.ts']
      }
    };

    const findings = detector.detectDebt([undocItem], usageMap);
    const undocFinding = findings.find((f) => f.category === 'undocumented_configuration');
    assert.ok(undocFinding, 'Undocumented configuration should be flagged');
    console.log('✓ Undocumented configuration detection passed');
  }
}
