/**
 * Configuration Debt Tracker - AI Explainer Layer (Optional Module)
 * Provides natural-language explanations and remediation guidance based strictly
 * on deterministic findings and evidence.
 *
 * Privacy Guarantee: NEVER transmits raw secret values or sensitive file contents.
 * Resiliency Guarantee: Fully functional offline via deterministic explanation engine.
 */

import { DebtFinding } from '../models/finding';
import { ScanResult } from '../models/scan';

export interface ExplanationResponse {
  summary: string;
  whyFlagged: string;
  evidenceExplanation: string;
  verificationSteps: string[];
  remediationAdvice: string;
  provider: 'gemini' | 'deterministic-offline';
}

export class AiExplainer {
  /**
   * Generates an explainable breakdown for a finding.
   * Uses Gemini API if an API key is provided and reachable; otherwise uses
   * the deterministic explanation engine.
   */
  async explainFinding(
    finding: DebtFinding,
    apiKey?: string
  ): Promise<ExplanationResponse> {
    const key = (apiKey || '').trim();

    if (key.length > 0) {
      try {
        const geminiResult = await this.queryGemini(finding, key);
        if (geminiResult) {
          return geminiResult;
        }
      } catch {
        // Fall back gracefully to offline deterministic engine
      }
    }

    return this.generateDeterministicExplanation(finding);
  }

  /**
   * Safe, privacy-preserving Gemini API integration using native fetch
   */
  private async queryGemini(
    finding: DebtFinding,
    apiKey: string
  ): Promise<ExplanationResponse | null> {
    const sanitizedPrompt = `You are a senior Software Configuration Management (SCM) architect analyzing a configuration debt finding.

Finding Metadata (No sensitive contents included):
- Configuration Key: ${finding.configurationItem.key}
- Debt Category: ${finding.categoryLabel}
- Risk Score: ${finding.riskScore}/100 (${finding.severity.toUpperCase()})
- Risk Breakdown: Age ${finding.riskBreakdown.ageScore}/25, Usage ${finding.riskBreakdown.usageScore}/35, Impact ${finding.riskBreakdown.impactScore}/25, Sensitivity ${finding.riskBreakdown.sensitivityScore}/15
- File: ${finding.configurationItem.filePath}:${finding.configurationItem.line}
- Format: ${finding.configurationItem.format.toUpperCase()}
- Evidence: ${finding.evidence.join(' ')}

Respond with a strictly formatted JSON object with these keys:
{
  "summary": "1-2 sentence executive summary of this configuration debt",
  "whyFlagged": "detailed explanation of why the static analysis engine flagged this item",
  "evidenceExplanation": "explanation of what the evidence proves",
  "verificationSteps": ["step 1 to verify before touching", "step 2", "step 3"],
  "remediationAdvice": "concrete technical steps to remediate safely without breaking production"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: sanitizedPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return null;
    }

    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || 'Configuration debt finding explanation',
      whyFlagged: parsed.whyFlagged || '',
      evidenceExplanation: parsed.evidenceExplanation || '',
      verificationSteps: Array.isArray(parsed.verificationSteps) ? parsed.verificationSteps : [],
      remediationAdvice: parsed.remediationAdvice || '',
      provider: 'gemini'
    };
  }

  /**
   * Deterministic explanation engine that operates 100% offline without external dependencies.
   */
  generateDeterministicExplanation(finding: DebtFinding): ExplanationResponse {
    const item = finding.configurationItem;
    const cat = finding.category;

    let summary = '';
    let whyFlagged = '';
    let evidenceExplanation = '';
    let verificationSteps: string[] = [];
    let remediationAdvice = '';

    switch (cat) {
      case 'dead_configuration':
        summary = `Configuration setting '${item.key}' in '${item.filePath}' appears to be dead code that is no longer referenced anywhere in the repository.`;
        whyFlagged = `The static analysis engine scanned all Python, TypeScript, JavaScript, and Java files and found zero instances of '${item.key}' being loaded via environment variables, configuration helpers, or property annotations.`;
        evidenceExplanation = `0 references detected across the entire source code inventory. Leaving dead configuration creates cognitive overhead and can mislead developers into believing obsolete infrastructure or flags are still active.`;
        verificationSteps = [
          `Search git commit history to determine when '${item.key}' was introduced and who owns it.`,
          `Check if '${item.key}' is injected dynamically via runtime deployment templates or external CI/CD pipelines not present in this workspace.`,
          `Run a test build or staging deployment with '${item.key}' commented out to confirm no hidden reflection or dynamic lookups fail.`
        ];
        remediationAdvice = `Delete the line '${item.key}' from '${item.filePath}:${item.line}' and re-run the Configuration Debt Tracker scan to confirm resolved debt.`;
        break;

      case 'duplicated_configuration':
        summary = `The configuration key '${item.key}' is declared across multiple files (${finding.affectedFiles.join(', ')}), creating high risk of configuration drift.`;
        whyFlagged = `Multiple configuration files contain duplicate definitions. If one file is updated during maintenance while another is overlooked, local, containerized, and production environments will behave inconsistently.`;
        evidenceExplanation = finding.evidence.join(' ');
        verificationSteps = [
          `Compare the values defined in each file (${finding.affectedFiles.join(', ')}) to verify whether they are meant to be identical or environment-specific.`,
          `Identify which file serves as the single authoritative source of truth (e.g. '.env' for local development or Helm/K8s for clusters).`
        ];
        remediationAdvice = `Centralize the definition of '${item.key}' in the root configuration file or environment template, and reference it via variable interpolation or container env injection.`;
        break;

      case 'hardcoded_secret':
        summary = `A sensitive credential or API key was detected in plaintext in '${item.filePath}:${item.line}'.`;
        whyFlagged = `The secret detection engine matched a known credential pattern (${finding.secretDetectionType || 'API key/secret token'}) or high-entropy literal. Committing plaintext secrets into repository files exposes infrastructure to unauthorized access.`;
        evidenceExplanation = `The value matched credential heuristics and is currently stored unencrypted in version control. Zero-exposure masking was applied in the UI.`;
        verificationSteps = [
          `Immediately check whether '${item.key}' represents an active production credential or a local test dummy.`,
          `If this is a real secret, revoke and rotate the credential immediately in your provider dashboard (e.g. Stripe, AWS, database host).`,
          `Verify that your repository's .gitignore properly excludes local '.env' files.`
        ];
        remediationAdvice = `1. Rotate the compromised credential.\n2. Move the value into an external secret store or local uncommitted .env file.\n3. Replace the plaintext value with a runtime environment variable reference.`;
        break;

      case 'stale_configuration':
        summary = `Configuration item '${item.key}' appears to be an obsolete or temporary feature flag that has lingered in the codebase.`;
        whyFlagged = `The key name or file modification age indicates a legacy, temporary, or deprecated configuration that should have been retired after feature rollout.`;
        evidenceExplanation = finding.evidence.join(' ');
        verificationSteps = [
          `Verify whether the underlying feature or migration associated with '${item.key}' has completed.`,
          `Review source references to verify if both branches of the feature flag are still maintained.`
        ];
        remediationAdvice = `Decommission the flag: remove the toggle from '${item.filePath}', remove the conditional branching in the source code, and retain only the permanent implementation.`;
        break;

      case 'undocumented_configuration':
        summary = `Configuration setting '${item.key}' in '${item.filePath}' has no documentation or explanatory comments.`;
        whyFlagged = `Configuration without documentation increases onboarding friction and causes misconfiguration during deployment or maintenance.`;
        evidenceExplanation = `No comments or docstrings were found preceding or inline with line ${item.line}.`;
        verificationSteps = [
          `Determine what type of values '${item.key}' accepts, what the default behavior is if omitted, and which team/service owns it.`
        ];
        remediationAdvice = `Add a comment directly above '${item.key}' in '${item.filePath}' explaining its purpose, valid values, defaults, and owner.`;
        break;
    }

    return {
      summary,
      whyFlagged,
      evidenceExplanation,
      verificationSteps,
      remediationAdvice,
      provider: 'deterministic-offline'
    };
  }

  /**
   * Conversational LLM assistant interface for querying configuration debt
   */
  async chatWithAssistant(
    userPrompt: string,
    scanResult: ScanResult | null,
    apiKey?: string
  ): Promise<string> {
    const key = (apiKey || '').trim();
    if (key.length > 0 && scanResult) {
      try {
        const topFindingsSummary = scanResult.findings.slice(0, 5).map(f =>
          `- ${f.title} (${f.severity.toUpperCase()}, risk ${f.riskScore}): ${f.suggestedAction} in ${f.configurationItem.filePath}:${f.configurationItem.line}`
        ).join('\n');

        const prompt = `You are an AI Software Configuration Management (SCM) expert for the Configuration Debt Tracker extension.
Current Repository State:
- Workspace: ${scanResult.workspaceName}
- Health Score: ${scanResult.healthScore.score}/100 (${scanResult.healthScore.grade})
- Total Items: ${scanResult.inventory.totalItems} (${scanResult.inventory.usedItems} used, ${scanResult.inventory.unusedItems} unused)
- Critical Issues: ${scanResult.inventory.bySeverity.critical}
- High Issues: ${scanResult.inventory.bySeverity.high}
- Top Findings:\n${topFindingsSummary}

User question: "${userPrompt}"

Give a concise, highly professional developer response (under 150 words) with actionable SCM guidance. Never reveal raw secrets.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 }
          })
        });
        if (response.ok) {
          const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answer) return answer.trim();
        }
      } catch {
        // Fall back to offline assistant
      }
    }

    return this.generateOfflineAssistantResponse(userPrompt, scanResult);
  }

  private generateOfflineAssistantResponse(query: string, scanResult: ScanResult | null): string {
    if (!scanResult) {
      return "No workspace scan results found. Click 'Scan Workspace' to identify configuration items and analyze configuration debt.";
    }

    const q = query.toLowerCase();
    const inv = scanResult.inventory;
    const topFindings = scanResult.findings;

    if (q.includes('critical') || q.includes('risk') || q.includes('top')) {
      const crits = topFindings.filter(f => f.severity === 'critical');
      if (crits.length === 0) {
        return `Great news! There are 0 critical configuration findings in ${scanResult.workspaceName}. Focus on resolving the ${inv.bySeverity.high} high-severity findings next.`;
      }
      return `Identified ${crits.length} Critical Issue(s):\n` +
        crits.map((f, i) => `${i + 1}. ${f.title} (${f.configurationItem.filePath}:${f.configurationItem.line}) -> ${f.suggestedAction}`).join('\n');
    }

    if (q.includes('health') || q.includes('score')) {
      return `Configuration Health is currently ${scanResult.healthScore.score}/100 (${scanResult.healthScore.grade}). Deductions were applied for ${inv.bySeverity.critical} critical item(s) (-${Math.min(45, inv.bySeverity.critical * 10)} pts) and ${inv.bySeverity.high} high-risk item(s). Cleaning up dead configurations and consolidating duplicates will restore health to >85.`;
    }

    if (q.includes('duplicate') || q.includes('drift')) {
      const dups = topFindings.filter(f => f.category === 'duplicated_configuration');
      if (dups.length === 0) return "No duplicated configurations detected across your configuration files.";
      return `Found ${dups.length} duplicated configuration setting(s). Ensure you consolidate these into a single authoritative file (e.g. '.env' or root config) and inject values via environment variables to avoid runtime desynchronization.`;
    }

    if (q.includes('secret') || q.includes('password') || q.includes('token') || q.includes('key')) {
      const secrets = topFindings.filter(f => f.category === 'hardcoded_secret');
      if (secrets.length === 0) return "No plaintext secrets detected in tracked configuration files.";
      return `Found ${secrets.length} plaintext secret(s). Recommended SCM procedure: 1. Rotate the compromised tokens in provider dashboards. 2. Remove values from version control. 3. Inject them at runtime using an encrypted secrets vault or local uncommitted .env.`;
    }

    // Default overview response
    return `Configuration Debt Summary for ${scanResult.workspaceName}:
• Health Score: ${scanResult.healthScore.score}/100 (${scanResult.healthScore.grade})
• Total Tracked: ${inv.totalItems} items (${inv.usedItems} active, ${inv.unusedItems} unused dead code)
• Priority Cleanups: ${inv.bySeverity.critical} Critical, ${inv.bySeverity.high} High, ${inv.bySeverity.medium} Medium
Remediation Recommendation: Address the top #${topFindings[0]?.configurationItem.key || '1'} finding in ${topFindings[0]?.configurationItem.filePath || 'your configuration'} first.`;
  }
}
