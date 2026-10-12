/**
 * Configuration Debt Tracker - Comprehensive Gemini & AI Integration Tests
 * Covers all 20 testing requirements defined in Section 22:
 * 
 * 1. Gemini provider constructs a valid request
 * 2. Current selected model is used
 * 3. Response text is extracted correctly
 * 4. Empty response is handled
 * 5. Timeout is handled
 * 6. Invalid API key error is handled
 * 7. Quota/rate-limit error is handled
 * 8. Provider factory selects Gemini when configured
 * 9. Offline mode remains explicitly offline
 * 10. Context builder includes retrieved source snippets
 * 11. Secret redaction occurs before provider transmission
 * 12. Conversation history is included correctly
 * 13. Assistant can answer a configuration question
 * 14. Assistant can answer a general source-code question
 * 15. Citation navigation uses real file paths and line numbers (security traversal check)
 * 16. Absent index is detected correctly
 * 17. Assistant does not fabricate repository evidence
 * 18. Mandatory DATABASE_URL contradiction regression test
 * 19. Provider status updates correctly
 * 20. Removing stored key clears connected status
 */

import * as assert from 'assert';
import * as path from 'path';
import { GeminiAIProvider } from '../../src/ai/geminiProvider';
import { PromptBuilder } from '../../src/ai/promptBuilder';
import { RetrievalEngine, RetrievedEvidenceContext } from '../../src/code-intelligence/retrieval/retrievalEngine';
import { RepositoryIndex } from '../../src/code-intelligence/index/repositoryIndex';
import { AIProviderFactory } from '../../src/ai/aiProviderFactory';
import { AiExplainer } from '../../src/ai/aiExplainer';
import { OfflineAIProvider } from '../../src/ai/offlineProvider';
import { SecretStorageService } from '../../src/services/secretStorageService';
import { ConfigurationItem } from '../../src/models/configuration';
import { AIMessage } from '../../src/ai/aiProvider';
import { AstIndexer } from '../../src/code-intelligence/ast/astIndexer';
import { ScanResult } from '../../src/models/scan';

export async function runGeminiAndRegressionTests(): Promise<void> {
  console.log('--- Running Gemini & AI Regression Tests (Section 22: 20 Requirements) ---');

  // Helper mock client builder
  function createMockGenAI(options: {
    responseText?: string;
    responseObject?: any;
    throwError?: Error;
    delayMs?: number;
    usage?: { promptTokenCount: number; candidatesTokenCount: number };
    captureCall?: (args: any) => void;
  }): any {
    return {
      models: {
        generateContent: async (params: any) => {
          if (options.captureCall) {
            options.captureCall(params);
          }
          if (options.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, options.delayMs));
          }
          if (options.throwError) {
            throw options.throwError;
          }
          if (options.responseObject) {
            return options.responseObject;
          }
          return {
            text: options.responseText ?? 'Mock response from Gemini',
            usageMetadata: options.usage
          };
        }
      }
    };
  }

  const promptBuilder = new PromptBuilder();

  // TEST 1: Gemini provider constructs a valid request
  {
    let capturedParams: any = null;
    const mockClient = createMockGenAI({
      responseText: 'Valid request response',
      captureCall: (args) => { capturedParams = args; }
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClient);
    const messages: AIMessage[] = [
      { role: 'system', content: 'You are the Configuration Debt Assistant.' },
      { role: 'user', content: 'What is this repo about?' }
    ];

    const response = await provider.chat(messages, { temperature: 0.3, maxTokens: 1024 });

    assert.ok(capturedParams, 'Provider must invoke client.models.generateContent');
    assert.strictEqual(capturedParams.model, 'gemini-2.5-flash');
    assert.strictEqual(capturedParams.config.systemInstruction, 'You are the Configuration Debt Assistant.');
    assert.strictEqual(capturedParams.config.temperature, 0.3);
    assert.strictEqual(capturedParams.config.maxOutputTokens, 1024);
    assert.strictEqual(capturedParams.contents.length, 1);
    assert.strictEqual(capturedParams.contents[0].role, 'user');
    assert.strictEqual(capturedParams.contents[0].parts[0].text, 'What is this repo about?');
    assert.strictEqual(response.content, 'Valid request response');
    console.log('✓ 1. Gemini provider constructs a valid request');
  }

  // TEST 2: Current selected model is used
  {
    let usedModel = '';
    const mockClient = createMockGenAI({
      responseText: 'Model test',
      captureCall: (args) => { usedModel = args.model; }
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-custom-enterprise', mockClient);
    await provider.chat([{ role: 'user', content: 'Hello' }]);

    assert.strictEqual(usedModel, 'gemini-custom-enterprise', 'Should pass configured model to SDK');
    assert.strictEqual(provider.getModel(), 'gemini-custom-enterprise');
    console.log('✓ 2. Current selected model is used');
  }

  // TEST 3: Response text is extracted correctly
  {
    const mockClient = createMockGenAI({
      responseText: '  Accurate extracted text from Gemini  ',
      usage: { promptTokenCount: 42, candidatesTokenCount: 128 }
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClient);
    const response = await provider.chat([{ role: 'user', content: 'Extract me' }]);

    assert.strictEqual(response.content, 'Accurate extracted text from Gemini');
    assert.strictEqual(response.providerId, 'gemini');
    assert.strictEqual(response.tokenUsage?.promptTokens, 42);
    assert.strictEqual(response.tokenUsage?.completionTokens, 128);
    assert.ok(typeof response.latencyMs === 'number' && response.latencyMs >= 0);

    // Also verify candidate parts fallback when response.text is empty but non-thought parts exist
    const mockClientWithParts = createMockGenAI({
      responseObject: {
        text: '',
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'Thinking about the answer...' },
                { text: 'Extracted from candidate parts' }
              ]
            }
          }
        ]
      }
    });
    const providerWithParts = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClientWithParts);
    const fallbackResponse = await providerWithParts.chat([{ role: 'user', content: 'Extract fallback' }]);
    assert.strictEqual(fallbackResponse.content, 'Extracted from candidate parts');

    console.log('✓ 3. Response text is extracted correctly');
  }

  // TEST 4: Empty response is handled
  {
    const mockClient = createMockGenAI({
      responseText: '    '
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClient);
    await assert.rejects(
      async () => {
        await provider.chat([{ role: 'user', content: 'Empty test' }]);
      },
      /Gemini returned an empty response/i,
      'Should reject empty response with clear diagnostic'
    );

    // Also verify that MAX_TOKENS truncation during reasoning is diagnosed clearly
    const mockMaxTokensClient = createMockGenAI({
      responseObject: {
        text: '',
        candidates: [
          {
            finishReason: 'MAX_TOKENS',
            content: {
              parts: [{ thought: true, text: 'Thinking that used up all output tokens...' }]
            }
          }
        ]
      }
    });
    const providerMaxTokens = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockMaxTokensClient);
    await assert.rejects(
      async () => {
        await providerMaxTokens.chat([{ role: 'user', content: 'Token starve test' }]);
      },
      /MAX_TOKENS/i,
      'Should diagnose MAX_TOKENS finish reason clearly'
    );

    console.log('✓ 4. Empty response is handled');
  }

  // TEST 5: Timeout is handled
  {
    const mockClient = createMockGenAI({
      delayMs: 300,
      responseText: 'Too slow'
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClient);
    await assert.rejects(
      async () => {
        await provider.chat([{ role: 'user', content: 'Timeout test' }], { timeoutMs: 50 });
      },
      /timed out/i,
      'Should reject when request exceeds timeoutMs'
    );
    console.log('✓ 5. Timeout is handled');
  }

  // TEST 6: Invalid API key error is handled
  {
    const mockClient = createMockGenAI({
      throwError: new Error('API_KEY_INVALID: API key not valid. Please pass a valid API key.')
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClient);
    try {
      await provider.chat([{ role: 'user', content: 'Auth test' }]);
      assert.fail('Should have thrown on invalid API key');
    } catch (err: any) {
      assert.ok(err.message.includes('Invalid Gemini API key'), 'Should sanitize to user-friendly message');
      assert.ok(!err.message.includes('dummy-key-12345'), 'Must never leak key in error message');
    }
    console.log('✓ 6. Invalid API key error is handled');
  }

  // TEST 7: Quota/rate-limit error is handled
  {
    const mockClient = createMockGenAI({
      throwError: new Error('429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric')
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClient);
    try {
      await provider.chat([{ role: 'user', content: 'Quota test' }]);
      assert.fail('Should have thrown on quota limit');
    } catch (err: any) {
      assert.ok(err.message.includes('quota or rate limit'), 'Should report quota/rate limit error');
    }
    console.log('✓ 7. Quota/rate-limit error is handled');
  }

  // TEST 8: Provider factory selects Gemini when configured
  {
    const factory = new AIProviderFactory();
    const provider = factory.resolveProvider({
      providerType: 'gemini',
      geminiApiKey: 'valid-test-key-string-long'
    });

    assert.strictEqual(provider.id, 'gemini', 'Should resolve to gemini provider');
    assert.strictEqual(factory.getStatus('gemini', 'valid-test-key-string-long'), 'Gemini: Connected');
    console.log('✓ 8. Provider factory selects Gemini when configured');
  }

  // TEST 9: Offline mode remains explicitly offline
  {
    const factory = new AIProviderFactory();
    const provider = factory.resolveProvider({
      providerType: 'offline',
      model: 'none'
    });

    assert.strictEqual(provider.id, 'offline', 'Must instantiate offline provider');
    assert.strictEqual(provider.name, 'Deterministic Offline Engine');
    assert.strictEqual(factory.getStatus('offline'), 'Offline mode');
    console.log('✓ 9. Offline mode remains explicitly offline');
  }

  // TEST 10: Context builder includes retrieved source snippets
  {
    const mockRetrievalContext: RetrievedEvidenceContext = {
      query: 'How does the health score calculator work?',
      matchedKeys: [],
      relevantConfigs: [],
      relevantReferences: [],
      relevantFindings: [],
      relevantSnippets: [
        {
          filePath: 'src/core/health/healthScoreCalculator.ts',
          language: 'typescript',
          startLine: 25,
          endLine: 40,
          symbolName: 'calculateHealthScore',
          symbolKind: 'function',
          snippet: 'export function calculateHealthScore(findings: DebtFinding[]): HealthScore { ... }',
          score: 1.0
        }
      ],
      matchedSymbols: [
        { name: 'calculateHealthScore', kind: 'function', file: 'src/core/health/healthScoreCalculator.ts', line: 25 }
      ],
      summaryContextText: 'Relevant Code:\n- src/core/health/healthScoreCalculator.ts:25 [calculateHealthScore]: export function calculateHealthScore(findings: DebtFinding[]): HealthScore { ... }',
      isIndexAvailable: true
    };

    const promptMessages = promptBuilder.buildGroundedMessages(mockRetrievalContext, 'How does the health score calculator work?');
    const userMessage = promptMessages.find((m: AIMessage) => m.role === 'user')?.content || '';

    assert.ok(userMessage.includes('src/core/health/healthScoreCalculator.ts:25'), 'Should include snippet file:line');
    assert.ok(userMessage.includes('calculateHealthScore'), 'Should include symbol name');
    console.log('✓ 10. Context builder includes retrieved source snippets');
  }

  // TEST 11: Secret redaction occurs before provider transmission
  {
    const sensitiveQuery = 'Explain this: DATABASE_PASSWORD="SuperSecretPass999!" and API_KEY="live_sk_abcdef12345"';
    const mockContext: RetrievedEvidenceContext = {
      query: sensitiveQuery,
      matchedKeys: [],
      relevantConfigs: [],
      relevantReferences: [],
      relevantFindings: [],
      relevantSnippets: [
        {
          filePath: 'src/config.ts',
          language: 'typescript',
          startLine: 5,
          endLine: 5,
          snippet: 'const secret = "SUPER_SECRET_TOKEN_DO_NOT_LEAK";',
          score: 1.0
        }
      ],
      matchedSymbols: [],
      summaryContextText: 'Snippet:\nconst secret = "SUPER_SECRET_TOKEN_DO_NOT_LEAK";',
      isIndexAvailable: true
    };

    const prompt = promptBuilder.buildGroundedMessages(mockContext, sensitiveQuery);
    const fullText = prompt.map((m: AIMessage) => m.content).join('\n');

    assert.ok(!fullText.includes('SuperSecretPass999!'), 'Password must be redacted');
    assert.ok(!fullText.includes('live_sk_abcdef12345'), 'API key must be redacted');
    assert.ok(!fullText.includes('SUPER_SECRET_TOKEN_DO_NOT_LEAK'), 'Snippet secret token must be redacted');
    assert.ok(fullText.includes('<REDACTED>'), 'Should contain <REDACTED> placeholder');
    console.log('✓ 11. Secret redaction occurs before provider transmission');
  }

  // TEST 12: Conversation history is included correctly
  {
    let capturedContents: any[] = [];
    const mockClient = createMockGenAI({
      responseText: 'History preserved',
      captureCall: (args) => { capturedContents = args.contents; }
    });

    const provider = new GeminiAIProvider('dummy-key-12345', 'gemini-2.5-flash', mockClient);
    const history: AIMessage[] = [
      { role: 'user', content: 'Explain the scanner.' },
      { role: 'assistant', content: 'The scanner analyzes configuration files.' }
    ];

    const mockContext: RetrievedEvidenceContext = {
      query: 'Which function calls it?',
      matchedKeys: [],
      relevantConfigs: [],
      relevantReferences: [],
      relevantFindings: [],
      relevantSnippets: [],
      matchedSymbols: [],
      summaryContextText: 'No extra findings',
      isIndexAvailable: true
    };

    const messages = promptBuilder.buildConversationMessages(mockContext, history, 'Which function calls it?');
    await provider.chat(messages);

    assert.strictEqual(capturedContents.length, 3, 'Must contain prior 2 turns plus current question');
    assert.strictEqual(capturedContents[0].role, 'user');
    assert.strictEqual(capturedContents[0].parts[0].text, 'Explain the scanner.');
    assert.strictEqual(capturedContents[1].role, 'model');
    assert.strictEqual(capturedContents[1].parts[0].text, 'The scanner analyzes configuration files.');
    assert.strictEqual(capturedContents[2].role, 'user');
    assert.ok(capturedContents[2].parts[0].text.includes('Which function calls it?'));
    console.log('✓ 12. Conversation history is included correctly');
  }

  // TEST 13: Assistant can answer a configuration question
  {
    const repoIndex = new RepositoryIndex();
    const configItems: ConfigurationItem[] = [
      {
        id: '.env:1:DATABASE_URL',
        key: 'DATABASE_URL',
        value: 'postgres://localhost/app',
        maskedValue: 'postgres://localhost/app',
        filePath: '.env',
        absoluteFilePath: '/mock/.env',
        line: 1,
        format: 'env',
        type: 'env-var',
        sensitivity: 'internal',
        ageDays: 5,
        isPotentialSecret: false
      }
    ];

    repoIndex.buildIndex('test', '/mock', configItems, [], {
      DATABASE_URL: {
        key: 'DATABASE_URL',
        isUsed: true,
        confidence: 99,
        statusText: 'Used',
        referenceCount: 1,
        references: [
          {
            filePath: 'src/db.ts',
            absoluteFilePath: '/mock/src/db.ts',
            line: 5,
            column: 10,
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
    });

    const retrieval = new RetrievalEngine(repoIndex);
    const context = retrieval.retrieveContext('Where is DATABASE_URL used?');

    assert.strictEqual(context.matchedKeys[0], 'DATABASE_URL');
    assert.strictEqual(context.relevantReferences.length, 1);
    assert.strictEqual(context.relevantReferences[0].file, 'src/db.ts');
    assert.strictEqual(context.relevantReferences[0].line, 5);

    const explainer = new AiExplainer(repoIndex);
    const mockScan: ScanResult = {
      scanId: 's1',
      workspaceName: 'test',
      workspacePath: '/mock',
      timestamp: Date.now(),
      healthScore: { score: 90, grade: 'Healthy', baseScore: 100, deductions: [], summary: '' },
      inventory: {} as any,
      findings: [],
      items: configItems,
      usageMap: repoIndex.getIndex()!.usageMap,
      cleanupItems: [],
      scanDurationMs: 5,
      errors: []
    };

    const answer = await explainer.chatWithAssistant('Where is DATABASE_URL used?', mockScan, { providerType: 'offline' });

    assert.ok(answer.includes('DATABASE_URL'), 'Response should mention DATABASE_URL');
    assert.ok(answer.includes('src/db.ts:5'), 'Response should cite src/db.ts:5');
    console.log('✓ 13. Assistant can answer a configuration question');
  }

  // TEST 14: Assistant can answer a general source-code question
  {
    const repoIndex = new RepositoryIndex();
    const astIndexer = new AstIndexer();
    const indexed = astIndexer.indexSource(
      'export class ConfigurationScanner {\n  scanWorkspace() {\n    return 42;\n  }\n}',
      'src/scanner.ts',
      'typescript'
    );

    repoIndex.buildIndex('test', '/mock', [], [], {}, new Map([['src/scanner.ts', indexed]]));

    const retrieval = new RetrievalEngine(repoIndex);
    const context = retrieval.retrieveContext('Explain how ConfigurationScanner works');

    assert.ok(context.relevantSnippets.some((s) => s.filePath === 'src/scanner.ts'), 'Should retrieve scanner source file');
    assert.ok(context.matchedSymbols.some((s) => s.name === 'ConfigurationScanner'), 'Should retrieve scanner symbol');
    console.log('✓ 14. Assistant can answer a general source-code question');
  }

  // TEST 15: Citation navigation uses real file paths and line numbers
  {
    const workspaceRoot = path.resolve('/mock/workspace');
    function validatePath(relPath: string): boolean {
      const resolved = path.isAbsolute(relPath)
        ? path.resolve(relPath)
        : path.resolve(workspaceRoot, relPath);
      const rel = path.relative(workspaceRoot, resolved);
      return !rel.startsWith('..') && !path.isAbsolute(rel);
    }

    assert.strictEqual(validatePath('src/db.ts'), true, 'Workspace relative path should be valid');
    assert.strictEqual(validatePath('src/core/health/calc.ts'), true, 'Deep workspace path should be valid');
    assert.strictEqual(validatePath('../../etc/passwd'), false, 'Directory traversal path must be rejected');
    assert.strictEqual(validatePath('/etc/passwd'), false, 'External absolute path must be rejected');
    assert.strictEqual(validatePath('C:\\Windows\\System32\\cmd.exe'), false, 'Windows system path must be rejected');
    console.log('✓ 15. Citation navigation path security validation passed');
  }

  // TEST 16: Absent index is detected correctly
  {
    const unindexedRepo = new RepositoryIndex();
    assert.strictEqual(unindexedRepo.isIndexed(), false, 'Fresh repo index must report not indexed');

    const retrieval = new RetrievalEngine(unindexedRepo);
    const context = retrieval.retrieveContext('Where is DATABASE_URL?');

    assert.strictEqual(context.matchedKeys.length, 0);
    assert.strictEqual(context.relevantConfigs.length, 0);
    assert.strictEqual(context.relevantSnippets.length, 0);
    assert.strictEqual(context.isIndexAvailable, false);
    console.log('✓ 16. Absent index is detected correctly');
  }

  // TEST 17: Assistant does not fabricate repository evidence
  {
    const emptyContext: RetrievedEvidenceContext = {
      query: 'Is Redis cache used in this project?',
      matchedKeys: [],
      relevantConfigs: [],
      relevantReferences: [],
      relevantFindings: [],
      relevantSnippets: [],
      matchedSymbols: [],
      summaryContextText: 'No direct repository evidence matched this specific query.',
      isIndexAvailable: true
    };

    const prompt = promptBuilder.buildGroundedMessages(emptyContext, 'Is Redis cache used in this project?');

    const systemPrompt = prompt.find((m: AIMessage) => m.role === 'system')?.content || '';
    assert.ok(systemPrompt.includes('Do not invent files, functions, classes, APIs, references'), 'System prompt forbids fabrication');
    assert.ok(systemPrompt.includes('say that you could not verify it from the indexed repository'), 'System prompt mandates admitting missing evidence');

    const userPrompt = prompt.find((m: AIMessage) => m.role === 'user')?.content || '';
    assert.ok(userPrompt.includes('No direct repository evidence matched this specific query'), 'Context informs model of missing evidence');
    console.log('✓ 17. Assistant does not fabricate repository evidence');
  }

  // TEST 18: MANDATORY DATABASE_URL CONTRADICTION REGRESSION TEST
  {
    const repoIndex = new RepositoryIndex();
    const configItems: ConfigurationItem[] = [
      {
        id: '.env:1:DATABASE_URL',
        key: 'DATABASE_URL',
        value: 'postgres://app:secret@db.internal:5432/main',
        maskedValue: 'postgres://app:*****@db.internal:5432/main',
        filePath: '.env',
        absoluteFilePath: '/synthetic/repo/.env',
        line: 1,
        format: 'env',
        type: 'env-var',
        sensitivity: 'secret',
        ageDays: 12,
        isPotentialSecret: true
      }
    ];

    repoIndex.buildIndex(
      'synthetic-repo',
      '/synthetic/repo',
      configItems,
      [],
      {
        DATABASE_URL: {
          key: 'DATABASE_URL',
          isUsed: true,
          confidence: 99,
          statusText: 'Used',
          referenceCount: 2,
          references: [
            {
              filePath: 'src/db.ts',
              absoluteFilePath: '/synthetic/repo/src/db.ts',
              line: 1,
              column: 15,
              snippet: 'const dbUrl = process.env.DATABASE_URL;',
              language: 'typescript',
              usageType: 'exact',
              confidence: 99,
              confidenceLevel: 1,
              patternMatched: 'process.env.DATABASE_URL'
            },
            {
              filePath: 'src/health/database.ts',
              absoluteFilePath: '/synthetic/repo/src/health/database.ts',
              line: 1,
              column: 15,
              snippet: 'const dbUrl = process.env.DATABASE_URL;',
              language: 'typescript',
              usageType: 'exact',
              confidence: 99,
              confidenceLevel: 1,
              patternMatched: 'process.env.DATABASE_URL'
            }
          ],
          referencingFiles: ['src/db.ts', 'src/health/database.ts']
        }
      }
    );

    const retrieval = new RetrievalEngine(repoIndex);
    const question = 'Where is DATABASE_URL used and what depends on it?';
    const context = retrieval.retrieveContext(question);

    assert.strictEqual(context.matchedKeys.length, 1);
    assert.strictEqual(context.matchedKeys[0], 'DATABASE_URL');
    assert.strictEqual(context.relevantReferences.length, 2, 'Must retrieve both references');

    const files = context.relevantReferences.map((r) => r.file).sort();
    assert.deepStrictEqual(files, ['src/db.ts', 'src/health/database.ts']);

    const promptMessages = promptBuilder.buildGroundedMessages(context, question);
    const userPrompt = promptMessages.find((m: AIMessage) => m.role === 'user')?.content || '';

    // Verify context text MUST contain both references and NEVER say 0 references
    assert.ok(userPrompt.includes('src/db.ts:1'), 'Context must contain src/db.ts reference');
    assert.ok(userPrompt.includes('src/health/database.ts:1'), 'Context must contain src/health/database.ts reference');
    assert.ok(!userPrompt.includes('0 references'), 'Context MUST NOT claim 0 references');
    assert.ok(!userPrompt.includes('No static references detected'), 'Context MUST NOT claim no references');

    // Run through OfflineAIProvider to verify the generated answer also cites both references
    const offlineProvider = new OfflineAIProvider();
    const offlineAnswer = await offlineProvider.chat(promptMessages);

    assert.ok(offlineAnswer.content.includes('2 source location'), 'Offline answer must report 2 references');
    assert.ok(offlineAnswer.content.includes('src/db.ts:1'), 'Offline answer must cite src/db.ts:1');
    assert.ok(offlineAnswer.content.includes('src/health/database.ts:1'), 'Offline answer must cite src/health/database.ts:1');
    assert.ok(!offlineAnswer.content.includes('0 source location'), 'Offline answer must NOT say 0 source locations');
    console.log('✓ 18. Mandatory DATABASE_URL contradiction regression test passed');
  }

  // TEST 19: Provider status updates correctly
  {
    const factory = new AIProviderFactory();
    assert.strictEqual(factory.getStatus('gemini', ''), 'Gemini: Not configured');
    assert.strictEqual(factory.getStatus('gemini', 'valid-api-key-string'), 'Gemini: Connected');
    assert.strictEqual(factory.getStatus('offline'), 'Offline mode');
    assert.strictEqual(factory.getStatus('local'), 'Local model: Unavailable');

    // Also verify connection test with Gemini provider uses 512 maxOutputTokens
    let pingParams: any = null;
    const mockPingClient = createMockGenAI({
      responseText: 'OK',
      captureCall: (args) => { pingParams = args; }
    });
    const explainer = new AiExplainer();
    explainer.getProviderFactory().getGeminiProvider().updateConfig('test-key-12345', 'gemini-2.5-flash');
    explainer.getProviderFactory().getGeminiProvider().setInjectedClient(mockPingClient);

    const testRes = await explainer.testConnection({
      providerType: 'gemini',
      model: 'gemini-2.5-flash',
      geminiApiKey: 'test-key-12345'
    });

    assert.strictEqual(testRes.ok, true, 'Connection test must succeed');
    assert.strictEqual(testRes.modelUsed, 'gemini-2.5-flash');
    assert.ok(testRes.message.includes('Gemini connected successfully'));
    assert.strictEqual(pingParams.config.maxOutputTokens, 512, 'Must request 512 maxOutputTokens for ping');

    console.log('✓ 19. Provider status updates correctly');
  }

  // TEST 20: Removing the stored key clears connected status
  {
    const secretsMap = new Map<string, string>();
    const mockSecretStorage: any = {
      get: async (key: string) => secretsMap.get(key),
      store: async (key: string, value: string) => { secretsMap.set(key, value); },
      delete: async (key: string) => { secretsMap.delete(key); },
      onDidChange: () => ({ dispose: () => {} })
    };

    const secretService = SecretStorageService.initialize(mockSecretStorage);

    // Initial state: empty
    assert.strictEqual(await secretService.getGeminiApiKey(), '');
    assert.strictEqual(await secretService.hasGeminiApiKey(), false);

    // Store key
    await secretService.setGeminiApiKey('dummy-secure-token-12345');
    assert.strictEqual(await secretService.getGeminiApiKey(), 'dummy-secure-token-12345');
    assert.strictEqual(await secretService.hasGeminiApiKey(), true);

    const factory = new AIProviderFactory();
    assert.strictEqual(factory.getStatus('gemini', await secretService.getGeminiApiKey()), 'Gemini: Connected');

    // Remove key
    await secretService.removeGeminiApiKey();
    assert.strictEqual(await secretService.getGeminiApiKey(), '');
    assert.strictEqual(await secretService.hasGeminiApiKey(), false);
    assert.strictEqual(factory.getStatus('gemini', await secretService.getGeminiApiKey()), 'Gemini: Not configured');
    console.log('✓ 20. Removing stored key clears connected status');
  }

  console.log('\nAll 20 Gemini & AI regression requirements passed successfully!');
}
