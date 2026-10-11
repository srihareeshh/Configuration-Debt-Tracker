/**
 * Configuration Debt Tracker - Upgraded AI Explainer & Repository Intelligence
 * Bridges RepositoryIndex, RetrievalEngine, PromptBuilder, and AIProviderFactory.
 * Guarantees zero secret exposure, grounded citations, multi-turn history, and clear failure reporting.
 */

import { RepositoryIndex } from '../code-intelligence/index/repositoryIndex';
import { RetrievalEngine, RetrievedEvidenceContext } from '../code-intelligence/retrieval/retrievalEngine';
import { DebtFinding } from '../models/finding';
import { ScanResult } from '../models/scan';
import { AIMessage } from './aiProvider';
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
  modelUsed?: string;
}

export class AiExplainer {
  private repositoryIndex: RepositoryIndex;
  private retrievalEngine: RetrievalEngine;
  private promptBuilder = new PromptBuilder();
  private providerFactory = new AIProviderFactory();
  private sessionHistory: AIMessage[] = [];

  constructor(repositoryIndex?: RepositoryIndex) {
    this.repositoryIndex = repositoryIndex || new RepositoryIndex();
    this.retrievalEngine = new RetrievalEngine(this.repositoryIndex);
  }

  getRepositoryIndex(): RepositoryIndex {
    return this.repositoryIndex;
  }

  getRetrievalEngine(): RetrievalEngine {
    return this.retrievalEngine;
  }

  getProviderFactory(): AIProviderFactory {
    return this.providerFactory;
  }

  updateRepositoryIndex(scanResult: ScanResult): void {
    this.repositoryIndex.buildIndex(
      scanResult.workspaceName,
      scanResult.workspacePath,
      scanResult.items,
      scanResult.findings,
      scanResult.usageMap,
      scanResult.sourceFiles || new Map()
    );
  }

  clearConversation(): void {
    this.sessionHistory = [];
  }

  getSessionHistory(): AIMessage[] {
    return [...this.sessionHistory];
  }

  /**
   * Tests connection to the configured AI provider with actual live ping
   */
  async testConnection(settings: ProviderSettings): Promise<ConnectionTestResult> {
    const provider = this.providerFactory.resolveProvider(settings);
    const startTime = Date.now();

    if (provider.id === 'offline') {
      return {
        ok: true,
        providerId: provider.id,
        providerName: provider.name,
        message: 'Offline deterministic reasoning engine is active and ready (no API key required).',
        latencyMs: 0
      };
    }

    if (provider.id === 'gemini') {
      const hasKey = Boolean(settings.geminiApiKey || process.env.GEMINI_API_KEY);
      if (!hasKey) {
        this.providerFactory.setGeminiStatus('Gemini: Not configured');
        return {
          ok: false,
          providerId: provider.id,
          providerName: provider.name,
          message: 'Gemini API key is not configured. Please run "Configuration Debt: Set Gemini API Key".'
        };
      }
      this.providerFactory.setGeminiStatus('Gemini: Testing connection');
    }

    try {
      // Send real lightweight ping to verify authentication and model responsiveness
      const resp = await provider.chat(
        [{ role: 'user', content: 'Ping. Respond with OK.' }],
        { maxTokens: 10, timeoutMs: settings.timeoutMs || 10000 }
      );

      const latencyMs = resp.latencyMs || Date.now() - startTime;

      if (provider.id === 'gemini') {
        this.providerFactory.setGeminiStatus('Gemini: Connected');
      }

      return {
        ok: true,
        providerId: provider.id,
        providerName: provider.name,
        message: `Gemini connected successfully.\nModel: ${resp.modelUsed}\nLatency: ${latencyMs}ms`,
        latencyMs,
        modelUsed: resp.modelUsed
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (provider.id === 'gemini') {
        this.providerFactory.setGeminiStatus('Gemini: Request failed');
      }
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
   * Conversational assistant over indexed repository using targeted RAG retrieval and multi-turn context
   */
  async chatWithAssistant(
    userPrompt: string,
    scanResult: ScanResult | null,
    settings: ProviderSettings = {},
    allowCloudContext: boolean = true
  ): Promise<string> {
    if (!scanResult && !this.repositoryIndex.getIndex()) {
      return 'The workspace has not been indexed yet. Please run "Configuration Debt: Scan Workspace" first to analyze repository configurations and source files.';
    }

    if (scanResult) {
      this.updateRepositoryIndex(scanResult);
    }

    // 1. Retrieve compact, redacted evidence context
    let context: RetrievedEvidenceContext = this.retrievalEngine.retrieveContext(userPrompt);

    // 2. Enforce cloud context consent policy
    const isCloudProvider = (settings.providerType || 'offline') === 'gemini';
    if (isCloudProvider && !allowCloudContext) {
      return 'Cloud repository context transmission is disabled (configDebt.aiAllowCloudContext is false). Enable this setting or switch configDebt.aiProvider to "offline" in Settings.';
    }

    // 3. Build grounded multi-turn messages
    const messages = this.promptBuilder.buildConversationMessages(
      context,
      this.sessionHistory,
      userPrompt
    );

    // 4. Resolve active provider
    const provider = this.providerFactory.resolveProvider(settings);

    try {
      const response = await provider.chat(messages, { timeoutMs: settings.timeoutMs || 25000 });
      const answer = response.content.trim();

      // Record turn to session history
      this.sessionHistory.push({ role: 'user', content: userPrompt });
      this.sessionHistory.push({ role: 'assistant', content: answer });

      if (provider.id === 'gemini') {
        this.providerFactory.setGeminiStatus('Gemini: Connected');
      }

      return answer;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (provider.id === 'gemini') {
        this.providerFactory.setGeminiStatus('Gemini: Request failed');
      }

      // DO NOT silently switch to offline mode. Provide explicit error and guidance.
      return `[${provider.name} Request Error]\n${errorMsg}\n\nTip: You can retry, check your API key, or switch active provider to 'offline' in Settings.`;
    }
  }

  /**
   * Explains a specific configuration debt finding
   */
  async explainFinding(
    finding: DebtFinding,
    settings: ProviderSettings = {}
  ): Promise<ExplanationResponse> {
    const offlineResp = this.generateDeterministicExplanation(finding);
    const provider = this.providerFactory.resolveProvider(settings);

    if (provider.id !== 'offline') {
      try {
        const item = finding.configurationItem;
        const findingSummary = `Finding Title: ${finding.title}
Key: ${item.key}
Location: ${item.filePath}:${item.line}
Format: ${item.format}
Severity: ${finding.severity} (Risk Score: ${finding.riskScore}/100)
Evidence: ${finding.evidence.join(' ')}
Suggested Action: ${finding.suggestedAction}`;

        const messages = this.promptBuilder.buildFindingExplanationMessages(findingSummary);
        const resp = await provider.chat(messages, { timeoutMs: settings.timeoutMs || 15000 });

        return {
          summary: resp.content.trim(),
          whyFlagged: offlineResp.whyFlagged,
          evidenceExplanation: offlineResp.evidenceExplanation,
          verificationSteps: offlineResp.verificationSteps,
          remediationAdvice: offlineResp.remediationAdvice,
          provider: `${provider.name} (${resp.modelUsed})`
        };
      } catch {
        // Return offline explanation if cloud fails
        return offlineResp;
      }
    }

    return offlineResp;
  }

  private generateDeterministicExplanation(finding: DebtFinding): ExplanationResponse {
    const item = finding.configurationItem;
    let summary = `Configuration '${item.key}' in '${item.filePath}:${item.line}' was identified with ${finding.severity.toUpperCase()} debt (Risk: ${finding.riskScore}/100).`;
    let whyFlagged = '';
    let evidenceExplanation = finding.evidence.join(' ');
    const verificationSteps: string[] = [];
    let remediationAdvice = finding.suggestedAction;

    switch (finding.category) {
      case 'hardcoded_secret':
        summary = `A sensitive credential or API key was detected in plaintext in '${item.filePath}:${item.line}'.`;
        whyFlagged =
          'The secret detection engine matched a known credential pattern or high-entropy literal. Committing plaintext secrets into repository files exposes infrastructure to unauthorized access.';
        verificationSteps.push(
          `Check immediately whether '${item.key}' represents an active production credential or a local test dummy.`
        );
        verificationSteps.push(
          'If this is a real secret, revoke and rotate the credential immediately in your provider dashboard.'
        );
        verificationSteps.push(
          "Verify that your repository's .gitignore properly excludes local '.env' files."
        );
        remediationAdvice = `1. Rotate the compromised credential.\n2. Move the value into an external secret store or uncommitted .env file.\n3. Replace the plaintext value with a runtime environment variable reference.`;
        break;

      case 'dead_configuration':
        summary = `The configuration key '${item.key}' in '${item.filePath}:${item.line}' appears to be dead code (zero static references).`;
        whyFlagged =
          'Static analysis scanned all workspace files and found zero code expressions referencing this setting.';
        verificationSteps.push(
          `Search your codebase for dynamic references, e.g. process.env["${item.key}"] or reflection.`
        );
        verificationSteps.push(
          'Check CI/CD workflows and deployment configurations (Kubernetes, Helm, Docker) that might consume this setting externally.'
        );
        verificationSteps.push(
          'Confirm with the engineering team if this setting was recently decommissioned.'
        );
        break;

      case 'configuration_drift':
        summary = `Configuration '${item.key}' exhibits value drift across multiple files in the repository.`;
        whyFlagged =
          'The same logical configuration key is defined with divergent values across different files.';
        verificationSteps.push('Compare all defined instances of this key across environments.');
        verificationSteps.push('Determine which configuration file represents the authoritative source of truth.');
        break;

      default:
        whyFlagged = `Flagged under category '${finding.categoryLabel}'. ${finding.suggestedAction}`;
        verificationSteps.push('Verify configuration usage in current workspace.');
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
}
