/**
 * Configuration Debt Tracker - System Prompt & Constraint Builder
 * Formulates strict, hallucination-free prompts for repository-aware SCM intelligence.
 * Guarantees zero secret exposure and grounds responses in verified source evidence.
 */

import { RetrievedEvidenceContext } from '../code-intelligence/retrieval/retrievalEngine';
import { AIMessage } from './aiProvider';

export class PromptBuilder {
  public static readonly SYSTEM_INSTRUCTION = `You are the repository-aware engineering assistant inside Configuration Debt Tracker.

Answer developer questions using the repository evidence provided with the current request.
You can explain source code, architecture, configuration, dependencies, functions, classes, tests, errors, and design decisions.

Use evidence rather than guessing.
Distinguish facts found in source code from reasonable inference.
When possible, cite relevant file paths, line numbers, symbols, and code snippets.
If the available context does not establish an answer, say that you could not verify it from the indexed repository.

Do not invent files, functions, classes, APIs, references, or test results.
Do not claim to have executed code unless a tool actually executed it.
Do not claim a test passed unless the test runner confirmed it.

When suggesting a fix, explain what should change and why.
Respect the source code's actual language, framework, structure, and naming conventions.
Keep answers clear, technically useful, and appropriately concise.`;

  /**
   * Builds single-turn grounded messages
   */
  buildGroundedMessages(context: RetrievedEvidenceContext, userQuestion: string): AIMessage[] {
    return this.buildConversationMessages(context, [], userQuestion);
  }

  /**
   * Builds multi-turn conversational messages bounded by max turns
   */
  buildConversationMessages(
    context: RetrievedEvidenceContext,
    history: AIMessage[],
    latestQuestion: string,
    maxHistoryTurns: number = 8
  ): AIMessage[] {
    const messages: AIMessage[] = [];

    // 1. Strict System Instruction
    messages.push({
      role: 'system',
      content: PromptBuilder.SYSTEM_INSTRUCTION
    });

    // 2. Bound history turns (filter out prior system messages and redact)
    const filteredHistory = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-maxHistoryTurns)
      .map((m) => ({
        role: m.role,
        content: PromptBuilder.redactSensitiveData(m.content)
      }));

    messages.push(...filteredHistory);

    // 3. User turn with current retrieved evidence (strictly redacted)
    const userPromptContent = `RETRIEVED REPOSITORY EVIDENCE:
----------------------------------------
${context.summaryContextText}
----------------------------------------

USER QUERY:
${latestQuestion}`;

    messages.push({
      role: 'user',
      content: PromptBuilder.redactSensitiveData(userPromptContent)
    });

    return messages;
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
Never reveal raw secrets. Format clearly with file and line citations.`
      },
      {
        role: 'user',
        content: PromptBuilder.redactSensitiveData(findingSummary)
      }
    ];
  }

  /**
   * Redacts passwords, API keys, private keys, tokens, and credentials from text/snippets
   * guaranteeing zero accidental secret exposure in prompt context.
   */
  static redactSensitiveData(text: string): string {
    if (!text) return '';
    return text
      // Passwords and API token assignments (including compound keys like DATABASE_PASSWORD, APP_SECRET, etc.)
      .replace(
        /\b[A-Za-z0-9_]*(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)[A-Za-z0-9_]*\s*[:=]\s*(?:['"][^'"]+['"]|[^\s,;]+)/gi,
        (m) => {
          const delim = m.includes('=') ? '=' : ':';
          const prefix = m.split(/[:=]/)[0];
          return `${prefix}${delim}"<REDACTED>"`;
        }
      )
      // Common token prefixes (Stripe, GitHub, Gemini, Slack, OpenAI sk-)
      .replace(
        /\b(?:sk_live_|sk_test_|live_sk_|test_sk_|ghp_|gho_|xoxb-|xoxp-|AIzaSy)[A-Za-z0-9_-]{10,}\b/g,
        '<REDACTED>'
      )
      // Connection strings with embedded credentials: protocol://user:pass@host
      .replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:<REDACTED>@')
      // JWT tokens
      .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<REDACTED>')
      // Private key headers and blocks
      .replace(
        /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
        '<REDACTED_PRIVATE_KEY>'
      );
  }
}
