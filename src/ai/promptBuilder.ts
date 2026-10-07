/**
 * Configuration Debt Tracker - System Prompt & Constraint Builder
 * Formulates strict, hallucination-free prompts for repository-aware SCM intelligence.
 */

import { RetrievedEvidenceContext } from '../code-intelligence/retrieval/retrievalEngine';
import { AIMessage } from './aiProvider';

export class PromptBuilder {
  /**
   * Builds the system prompt and user message grounded strictly in retrieved repository evidence.
   */
  buildGroundedMessages(context: RetrievedEvidenceContext, userQuestion: string): AIMessage[] {
    const systemInstruction = `You are the Configuration Debt Tracker repository intelligence assistant.
You are an expert in Software Configuration Management (SCM), code intelligence, static analysis, and technical debt remediation.

STRICT OPERATIONAL RULES:
1. GROUNDED IN EVIDENCE ONLY: Answer ONLY from the retrieved repository evidence provided below. If you cannot verify a fact, explicitly state: "I could not verify this from the indexed repository."
2. ZERO HALLUCINATION: Never invent files, symbols, functions, configurations, owners, or runtime behaviors not in the evidence.
3. ZERO SECRET EXPOSURE: All secrets must remain redacted (<REDACTED>). Never guess or reveal raw secrets.
4. CITATIONS & CONFIDENCE: Every statement must cite specific locations (e.g., src/db.ts:12) and explain uncertainty. Distinguish static evidence from runtime inference.
5. SCM STRUCTURED FORMAT: For analytical questions, format your response cleanly:
   ANSWER: Direct, precise answer.
   EVIDENCE: Bulleted list with clickable file:line locations.
   CONFIDENCE: High / Medium / Low with percentage.
   RECOMMENDATION: Concrete, safe SCM action.`;

    const userPromptContent = `RETRIEVED REPOSITORY EVIDENCE:
----------------------------------------
${context.summaryContextText}
----------------------------------------

USER QUERY:
${userQuestion}`;

    return [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPromptContent }
    ];
  }

  /**
   * Builds explanation prompt for a specific configuration finding
   */
  buildFindingExplanationMessages(findingSummary: string): AIMessage[] {
    return [
      {
        role: 'system',
        content: `You are an SCM auditor explaining a configuration debt finding.
Provide an explainable breakdown:
1. Executive Summary
2. Why Flagged
3. Evidence Breakdown
4. Verification Steps before touching
5. Remediation Recommendation
Never reveal raw secrets.`
      },
      {
        role: 'user',
        content: findingSummary
      }
    ];
  }

  /**
   * Redacts passwords, API keys, private keys, tokens, and credentials from text/snippets
   * guaranteeing zero accidental secret exposure in prompt context.
   */
  static redactSensitiveData(text: string): string {
    return text
      // Passwords and API token assignments
      .replace(/(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][^'"]+['"]/gi, (m) => {
        const prefix = m.split(/[:=]/)[0];
        return `${prefix}="<REDACTED>"`;
      })
      // Common token prefixes (Stripe, GitHub, JWT, etc.)
      .replace(/\b(?:sk_live_|ghp_|gho_|xoxb-|xoxp-)[A-Za-z0-9_]{16,}\b/g, '<REDACTED>')
      // JWT tokens
      .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<REDACTED>')
      // Connection strings with embedded credentials: protocol://user:pass@host
      .replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:<REDACTED>@')
      // Private key headers and blocks
      .replace(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g, '<REDACTED_PRIVATE_KEY>');
  }
}
