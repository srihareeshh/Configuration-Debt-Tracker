/**
 * Tests for Layer B AI Engine:
 * 1. Secret Redaction Policy (Zero credential leakage)
 * 2. Retrieval Engine (Targeted context and evidence collection)
 * 3. Offline AI Provider (Grounded deterministic responses)
 * 4. Provider Factory & Fallback
 * 5. AI Explainer & Removal Impact Assessment
 */

import * as assert from 'assert';
import { PromptBuilder } from '../../src/ai/promptBuilder';
import { RetrievalEngine } from '../../src/code-intelligence/retrieval/retrievalEngine';
import { RepositoryIndex } from '../../src/code-intelligence/index/repositoryIndex';
import { OfflineAIProvider } from '../../src/ai/offlineProvider';
import { AIProviderFactory } from '../../src/ai/aiProviderFactory';
import { AiExplainer } from '../../src/ai/aiExplainer';
import { ConfigurationItem } from '../../src/models/configuration';
import { DebtFinding } from '../../src/models/finding';
import { ScanResult } from '../../src/models/scan';

export async function runAITests(): Promise<void> {
  console.log('--- Running AI & Retrieval Tests ---');

  // Test 1: Secret Redaction (PromptBuilder)
  {
    const rawCodeWithSecrets = `
      const dbPassword = "SuperSecretPassword123!";
      const apiKey = "mock_test_secret_token_123456";
      const connStr = "mongodb://admin:p@ssw0rd99@cluster0.mongodb.net/prod";
      const jwtToken = "mock.jwt.token.signature.segment";
      const normalConfig = process.env.API_TIMEOUT;
    `;

    const redacted = PromptBuilder.redactSensitiveData(rawCodeWithSecrets);

    assert.ok(!redacted.includes('SuperSecretPassword123!'), 'Plaintext password must be redacted');
    assert.ok(!redacted.includes('mock_test_secret_token_123456'), 'Plaintext API token must be redacted');
    assert.ok(!redacted.includes('p@ssw0rd99'), 'Database connection string password must be redacted');
    assert.ok(redacted.includes('<REDACTED>'), 'Should insert <REDACTED> markers');
    assert.ok(redacted.includes('process.env.API_TIMEOUT'), 'Safe configuration references must be preserved');
    console.log('✓ Secret redaction passed (Zero credential exposure)');
  }

  // Test 2: Retrieval Engine
  {
    const repoIndex = new RepositoryIndex();
    const retrieval = new RetrievalEngine(repoIndex);

    const configItems: ConfigurationItem[] = [
      {
        id: '.env:1:DATABASE_URL',
        key: 'DATABASE_URL',
        value: 'postgres://localhost/app',
        maskedValue: 'postgres://localhost/app',
        filePath: '.env',
        absoluteFilePath: '/mock/repo/.env',
        line: 1,
        format: 'env',
        type: 'env-var',
        sensitivity: 'internal',
        ageDays: 10,
        isPotentialSecret: false
      },
      {
        id: '.env:2:OLD_API_URL',
        key: 'OLD_API_URL',
        value: 'https://v1.api.com',
        maskedValue: 'https://v1.api.com',
        filePath: '.env',
        absoluteFilePath: '/mock/repo/.env',
        line: 2,
        format: 'env',
        type: 'env-var',
        sensitivity: 'public',
        ageDays: 100,
        isPotentialSecret: false
      }
    ];

    repoIndex.buildIndex(
      'mock-repo',
      '/mock/repo',
      configItems,
      [],
      {
        DATABASE_URL: {
          key: 'DATABASE_URL',
          isUsed: true,
          confidence: 99,
          statusText: 'Used',
          referenceCount: 1,
          references: [
            {
              filePath: 'src/db.ts',
              absoluteFilePath: '/mock/repo/src/db.ts',
              line: 1,
              column: 15,
              snippet: 'const db = process.env.DATABASE_URL;',
              language: 'typescript',
              usageType: 'exact',
              confidence: 99,
              confidenceLevel: 1,
              patternMatched: 'process.env.DATABASE_URL'
            }
          ],
          referencingFiles: ['src/db.ts']
        }
      }
    );

    const context = retrieval.retrieveContext('Where is DATABASE_URL used and what depends on it?');

    assert.ok(context.matchedKeys.includes('DATABASE_URL'));
    assert.strictEqual(context.relevantConfigs.length, 1);
    assert.strictEqual(context.relevantReferences.length, 1);
    assert.strictEqual(context.relevantReferences[0].file, 'src/db.ts');
    assert.strictEqual(context.relevantReferences[0].line, 1);
    console.log('✓ Retrieval engine context extraction passed');
  }

  // Test 3: Offline Provider Grounded Answering & AI Explainer
  {
    const offlineProvider = new OfflineAIProvider();
    const isAvail = await offlineProvider.isAvailable();
    assert.strictEqual(isAvail, true, 'Offline provider must always be available');

    const configItem: ConfigurationItem = {
      id: '.env:1:DATABASE_URL',
      key: 'DATABASE_URL',
      value: 'postgres://localhost/app',
      maskedValue: 'postgres://localhost/app',
      filePath: '.env',
      absoluteFilePath: '/mock/repo/.env',
      line: 1,
      format: 'env',
      type: 'env-var',
      sensitivity: 'internal',
      ageDays: 10,
      isPotentialSecret: false
    };

    const mockFinding: DebtFinding = {
      id: 'finding:dead:DATABASE_URL',
      title: 'Unused configuration DATABASE_URL',
      category: 'dead_configuration',
      categoryLabel: 'Dead Configuration',
      severity: 'medium',
      riskScore: 35,
      riskBreakdown: {
        ageScore: 5,
        usageScore: 0,
        impactScore: 15,
        sensitivityScore: 15,
        total: 35,
        severity: 'medium',
        explanation: {
          ageFactor: '10 days',
          usageFactor: '0 references',
          impactFactor: 'single file',
          sensitivityFactor: 'internal'
        }
      },
      configurationItem: configItem,
      confidence: 95,
      evidence: ['No static references detected'],
      affectedFiles: ['.env'],
      blindSpots: ['Dynamic key lookup'],
      recommendation: 'Check external manifests before removing',
      suggestedAction: 'Remove unused key DATABASE_URL from .env'
    };

    const explainer = new AiExplainer();
    const explanation = await explainer.explainFinding(mockFinding, { providerType: 'offline' });
    assert.ok(explanation.summary.includes('DATABASE_URL'), 'Explanation summary should cite key');
    assert.ok(explanation.whyFlagged.length > 0, 'Explanation should state why flagged');
    assert.ok(explanation.verificationSteps.length > 0, 'Explanation should provide verification steps');
    assert.ok(explanation.remediationAdvice.length > 0, 'Explanation should provide remediation advice');

    const mockScan: ScanResult = {
      scanId: 'scan-ai-test',
      workspaceName: 'test',
      workspacePath: '/mock/repo',
      timestamp: Date.now(),
      healthScore: { score: 90, grade: 'Healthy', baseScore: 100, deductions: [], summary: '' },
      inventory: {
        totalItems: 1,
        usedItems: 0,
        unusedItems: 1,
        duplicateItems: 0,
        driftItems: 0,
        secretItems: 0,
        undocumentedItems: 0,
        byFormat: {} as any,
        bySeverity: { critical: 0, high: 0, medium: 1, low: 0 },
        byCategory: {} as any
      },
      findings: [mockFinding],
      items: [configItem],
      usageMap: {},
      cleanupItems: [],
      scanDurationMs: 10,
      errors: []
    };

    const { ImpactAnalyzer } = require('../../src/core/impact/impactAnalyzer');
    const impactAnalyzer = new ImpactAnalyzer();
    const removalImpact = impactAnalyzer.assessRemovalImpact('DATABASE_URL', mockScan);
    assert.strictEqual(removalImpact.configurationKey, 'DATABASE_URL');
    assert.strictEqual(removalImpact.staticReferenceCount, 0, 'Dead config removal should indicate zero static references');
    assert.ok(removalImpact.blindSpots && removalImpact.blindSpots.length > 0, 'Should outline blind spots');

    console.log('✓ Offline grounded AI explanations & removal impact passed');
  }

  // Test 4: Provider Factory Initialization & Fallback
  {
    const factory = new AIProviderFactory();
    const offlineInstance = factory.resolveProvider({
      providerType: 'offline',
      model: 'none'
    });

    assert.strictEqual(offlineInstance.id, 'offline', 'Should instantiate offline provider when configured');

    const localInstance = factory.resolveProvider({
      providerType: 'local',
      model: 'qwen2.5-coder:7b',
      endpoint: 'http://localhost:11434/v1'
    });

    assert.strictEqual(localInstance.id, 'local', 'Should instantiate local provider when configured');
    console.log('✓ AI provider factory instantiation passed');
  }
}
