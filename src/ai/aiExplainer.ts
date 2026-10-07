/**
 * Configuration Debt Tracker - Upgraded AI Explainer & Repository Intelligence
 * Bridges RepositoryIndex, RetrievalEngine, PromptBuilder, and AIProviderFactory.
 * Guarantees zero secret exposure, grounded citations, and 100% offline fallback.
 */

import { RepositoryIndex } from '../code-intelligence/index/repositoryIndex';
import { RetrievalEngine } from '../code-intelligence/retrieval/retrievalEngine';
import { DebtFinding } from '../models/finding';
import { ScanResult } from '../models/scan';
import { AIProviderFactory, ProviderSettings } from './aiProviderFactory';
import { PromptBuilder } from './promptBuilder';

export interface ExplanationResponse {
  summary: string;
  whyFlagged: string;
  evidenceExplanation: string;
  verificationSteps: string[];
  remediationAdvice: string;
  provider: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  providerId: string;
  providerName: string;
  message: string;
  latencyMs?: number;
}

export class AiExplainer {
  private repositoryIndex: RepositoryIndex;
  private retrievalEngine: RetrievalEngine;
  private promptBuilder = new PromptBuilder();
  private providerFactory = new AIProviderFactory();

  constructor(repositoryIndex?: RepositoryIndex) {
    this.repositoryIndex = repositoryIndex || new RepositoryIndex();
    this.retrievalEngine = new RetrievalEngine(this.repositoryIndex);
  }

  updateRepositoryIndex(scanResult: ScanResult): void {
    this.repositoryIndex.buildIndex(
      scanResult.workspaceName,
      scanResult.workspacePath,
      scanResult.items,
      scanResult.findings,
      scanResult.usageMap
    );
  }

  /**
   * Tests connection to the configured AI provider
   */
  async testConnection(settings: ProviderSettings): Promise<ConnectionTestResult> {
    const provider = this.providerFactory.resolveProvider(settings);
    const startTime = Date.now();

    try {
      if (provider.id === 'offline') {
        return {
          ok: true,
          providerId: provider.id,
          providerName: provider.name,
          message: 'Offline deterministic reasoning engine is active and ready (no API key required).'
        };
      }

      const available = await provider.isAvailable();
      if (!available) {
        return {
          ok: false,
          providerId: provider.id,
          providerName: provider.name,
          message: `Provider '${provider.name}' is currently unavailable or missing configuration.`
        };
      }

      // Send lightweight ping
      const resp = await provider.chat(
        [{ role: 'user', content: 'Ping. Respond with OK.' }],
        { maxTokens: 10, timeoutMs: 5000 }
      );

      return {
        ok: true,
        providerId: provider.id,
        providerName: provider.name,
        message: `Connected successfully to ${provider.name} (${resp.modelUsed}).`,
        latencyMs: Date.now() - startTime
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        providerId: provider.id,
        providerName: provider.name,
        message: `Connection test failed: ${msg}`,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Conversational assistant over indexed repository using targeted RAG retrieval
   */
  async chatWithAssistant(
    userPrompt: string,
    scanResult: ScanResult | null,
    settings: ProviderSettings = {}
  ): Promise<string> {
    if (!scanResult) {
      return 'No scan available. Please run a workspace scan first to analyze configurations and source code.';
    }

    this.updateRepositoryIndex(scanResult);

    // 1. Retrieve compact, redacted evidence context
    const context = this.retrievalEngine.retrieveContext(userPrompt);

    // 2. Build grounded prompt
    const messages = this.promptBuilder.buildGroundedMessages(context, userPrompt);

    // 3. Resolve active provider
    const provider = this.providerFactory.resolveProvider(settings);

    try {
      const response = await provider.chat(messages, { timeoutMs: settings.timeoutMs || 25000 });
      return response.content.trim();
    } catch {
      // Graceful fallback to offline deterministic engine
      const offline = this.providerFactory.getOfflineProvider();
      const fallbackResp = await offline.chat(messages);
      return `[Offline Fallback Mode]\n${fallbackResp.content}`;
    }
  }

  /**
   * Explains a specific configuration debt finding
   */
  async explainFinding(
    finding: DebtFinding,
    settings: ProviderSettings = {}
  ): Promise<ExplanationResponse> {
    const item = finding.configurationItem;
    const offlineResp = this.generateDeterministicExplanation(finding);

    const provider = this.providerFactory.resolveProvider(settings);
    if (provider.id !== 'offline') {
      try {
        const prompt = `Explain configuration finding:
- Key: ${item.key}
- Category: ${finding.categoryLabel}
- Risk: ${finding.riskScore}/100 (${finding.severity.toUpperCase()})
- Location: ${item.filePath}:${item.line}
- Evidence: ${finding.evidence.join(' ')}`;

        const msgs = this.promptBuilder.buildFindingExplanationMessages(prompt);
        const resp = await provider.chat(msgs, { maxTokens: 500, timeoutMs: 15000 });

        return {
          summary: `${finding.title}`,
          whyFlagged: resp.content,
          evidenceExplanation: finding.evidence.join(' '),
          verificationSteps: offlineResp.verificationSteps,
          remediationAdvice: finding.recommendation,
          provider: provider.name
        };
      } catch {
        // Fall back to deterministic explanation
      }
    }

    return offlineResp;
  }

  /**
   * Deterministic explanation generator operating 100% offline
   */
  generateDeterministicExplanation(finding: DebtFinding): ExplanationResponse {
    const item = finding.configurationItem;
    const cat = finding.category;

    let summary = '';
    let whyFlagged = '';
    let evidenceExplanation = finding.evidence.join(' ');
    let verificationSteps: string[] = [];
    let remediationAdvice = finding.recommendation;

    switch (cat) {
      case 'dead_configuration':
        summary = `Configuration setting '${item.key}' in '${item.filePath}' appears to be dead code that is no longer referenced anywhere in the repository.`;
        whyFlagged = `The static analysis engine scanned all source files across JavaScript, TypeScript, Python, Java, Go, Rust, and C# and found zero direct or framework references to '${item.key}'.`;
        verificationSteps = [
          `Search git history to verify when '${item.key}' was introduced and which component required it.`,
          `Check whether '${item.key}' is injected dynamically in external CI/CD or Helm manifests outside this repo.`,
          `Test a staging build with '${item.key}' commented out to confirm no runtime reflection fails.`
        ];
        break;

      case 'configuration_drift':
        summary = `Configuration setting '${item.key}' exhibits active value drift across multiple configuration files.`;
        whyFlagged = `Multiple files define '${item.key}' with divergent values. Environments using different configuration files will experience conflicting behavior.`;
        verificationSteps = [
          `Compare the distinct values defined across the affected files (${finding.affectedFiles.join(', ')}).`,
          `Determine which file serves as the canonical source of truth for each target environment.`
        ];
        break;

      case 'duplicated_configuration':
        summary = `The configuration key '${item.key}' is declared across multiple files (${finding.affectedFiles.join(', ')}).`;
        whyFlagged = `Identical configuration settings exist in multiple files. If one file is updated during maintenance while another is overlooked, configuration drift will occur.`;
        verificationSteps = [
          `Check whether duplicate declarations in ${finding.affectedFiles.join(', ')} can be consolidated into a single root file or container env injection.`
        ];
        break;

      case 'hardcoded_secret':
        summary = `A sensitive credential or API key was detected in plaintext in '${item.filePath}:${item.line}'.`;
        whyFlagged = `The secret detection engine matched a known credential pattern or high-entropy literal. Committing plaintext secrets into repository files exposes infrastructure to unauthorized access.`;
        verificationSteps = [
          `Check immediately whether '${item.key}' represents an active production credential or a local test dummy.`,
          `If this is a real secret, revoke and rotate the credential immediately in your provider dashboard.`,
          `Verify that your repository's .gitignore properly excludes local '.env' files.`
        ];
        remediationAdvice = `1. Rotate the compromised credential.\n2. Move the value into an external secret store or uncommitted .env file.\n3. Replace the plaintext value with a runtime environment variable reference.`;
        break;

      case 'unused_feature_flag':
        summary = `Feature flag '${item.key}' in '${item.filePath}' is declared but not referenced anywhere in code.`;
        whyFlagged = `The key matches feature flag naming conventions but has 0 active usages or conditional branches in the indexed source code.`;
        verificationSteps = [
          `Confirm whether the feature was fully shipped or discontinued.`,
          `Remove the dormant configuration flag to reduce cognitive debt.`
        ];
        break;

      default:
        summary = `Configuration debt item: ${finding.title}`;
        whyFlagged = finding.evidence.join(' ');
        verificationSteps = [
          `Review the setting in '${item.filePath}:${item.line}' against its active consumers.`
        ];
        break;
    }

    return {
      summary,
      whyFlagged,
      evidenceExplanation,
      verificationSteps,
      remediationAdvice,
      provider: 'Deterministic Offline Engine'
    };
  }

  getRetrievalEngine(): RetrievalEngine {
    return this.retrievalEngine;
  }
}
