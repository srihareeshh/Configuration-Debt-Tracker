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
        value: '5000', // Identical value - true duplicate
        maskedValue: '5000',
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
    console.log('✓ Duplicated configuration detection passed');
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

  // Test 7: Value Drift Detection
  {
    const driftItems: ConfigurationItem[] = [
      {
        id: '.env:1:CACHE_TTL',
        key: 'CACHE_TTL',
        value: '3600',
        maskedValue: '3600',
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
        id: 'application.yml:10:CACHE_TTL',
        key: 'CACHE_TTL',
        value: '7200',
        maskedValue: '7200',
        filePath: 'application.yml',
        absoluteFilePath: '/mock/application.yml',
        line: 10,
        format: 'yaml',
        type: 'yaml-property',
        sensitivity: 'public',
        ageDays: 10,
        isPotentialSecret: false
      }
    ];

    const usageMap: Record<string, UsageAnalysis> = {
      CACHE_TTL: {
        key: 'CACHE_TTL',
        isUsed: true,
        confidence: 95,
        statusText: 'Used',
        referenceCount: 1,
        references: [],
        referencingFiles: ['src/cache.ts']
      }
    };

    const findings = detector.detectDebt(driftItems, usageMap);
    const driftFinding = findings.find((f) => f.category === 'configuration_drift');
    assert.ok(driftFinding, 'Configuration drift finding must be generated when values differ');
    assert.strictEqual(driftFinding?.category, 'configuration_drift');
    console.log('✓ Configuration drift detection passed');
  }

  // Test 8: Unused Feature Flag Detection
  {
    const ffItem: ConfigurationItem = {
      id: '.env:20:FEATURE_DARK_MODE',
      key: 'FEATURE_DARK_MODE',
      value: 'false',
      maskedValue: 'false',
      filePath: '.env',
      absoluteFilePath: '/mock/.env',
      line: 20,
      format: 'env',
      type: 'env-var',
      sensitivity: 'public',
      ageDays: 30,
      isPotentialSecret: false
    };

    const usageMap: Record<string, UsageAnalysis> = {
      FEATURE_DARK_MODE: {
        key: 'FEATURE_DARK_MODE',
        isUsed: false,
        confidence: 0,
        statusText: 'Unused',
        referenceCount: 0,
        references: [],
        referencingFiles: []
      }
    };

    const findings = detector.detectDebt([ffItem], usageMap);
    const ffFinding = findings.find((f) => f.category === 'unused_feature_flag');
    assert.ok(ffFinding, 'Unused feature flag must be categorized as unused_feature_flag, not plain dead');
    console.log('✓ Unused feature flag detection passed');
  }

  // Test 9: Test-Only Configuration Detection
  {
    const testOnlyItem: ConfigurationItem = {
      id: '.env:30:MOCK_PAYMENT_GATEWAY',
      key: 'MOCK_PAYMENT_GATEWAY',
      value: 'true',
      maskedValue: 'true',
      filePath: '.env',
      absoluteFilePath: '/mock/.env',
      line: 30,
      format: 'env',
      type: 'env-var',
      sensitivity: 'public',
      ageDays: 15,
      isPotentialSecret: false
    };

    const usageMap: Record<string, UsageAnalysis> = {
      MOCK_PAYMENT_GATEWAY: {
        key: 'MOCK_PAYMENT_GATEWAY',
        isUsed: true,
        confidence: 96,
        statusText: 'Used',
        referenceCount: 2,
        references: [],
        referencingFiles: ['tests/payments.test.ts', 'tests/e2e/checkout.spec.ts'],
        isTestOnly: true
      }
    };

    const findings = detector.detectDebt([testOnlyItem], usageMap);
    const testFinding = findings.find((f) => f.category === 'test_only_configuration');
    assert.ok(testFinding, 'Should detect test-only configuration declared in root config');
    console.log('✓ Test-only configuration detection passed');
  }

  // Test 10: Suspicious Dynamic Reference Detection
  {
    const dynItem: ConfigurationItem = {
      id: '.env:40:DYNAMIC_ROUTE',
      key: 'DYNAMIC_ROUTE',
      value: '/api/v2',
      maskedValue: '/api/v2',
      filePath: '.env',
      absoluteFilePath: '/mock/.env',
      line: 40,
      format: 'env',
      type: 'env-var',
      sensitivity: 'public',
      ageDays: 20,
      isPotentialSecret: false
    };

    const usageMap: Record<string, UsageAnalysis> = {
      DYNAMIC_ROUTE: {
        key: 'DYNAMIC_ROUTE',
        isUsed: true,
        confidence: 70,
        statusText: 'Used',
        referenceCount: 1,
        references: [],
        referencingFiles: ['src/router.ts'],
        highestConfidenceLevel: 6
      }
    };

    const findings = detector.detectDebt([dynItem], usageMap);
    const dynFinding = findings.find((f) => f.category === 'suspicious_dynamic_reference');
    assert.ok(dynFinding, 'Should detect suspicious dynamic reference for Level 6 resolution');
    console.log('✓ Suspicious dynamic reference detection passed');
  }
}
