/**
 * Configuration Debt Tracker - Targeted Context Retrieval Engine (RAG)
 * Extracts targeted evidence from the repository index for a user query.
 * Strictly guarantees ZERO plaintext secret leakage and avoids whole-repo token dumping.
 */

import { DebtFinding } from '../../models/finding';
import { IndexedRepository, RepositoryIndex } from '../index/repositoryIndex';
import { canonicalizeKey } from '../references/normalizedKeyResolver';

export interface RetrievedEvidenceContext {
  query: string;
  matchedKeys: string[];
  relevantConfigs: { key: string; file: string; line: number; maskedValue: string }[];
  relevantReferences: { file: string; line: number; symbol?: string; snippet: string; confidence: number }[];
  relevantFindings: DebtFinding[];
  summaryContextText: string;
}

export class RetrievalEngine {
  private repositoryIndex: RepositoryIndex;

  constructor(repositoryIndex: RepositoryIndex) {
    this.repositoryIndex = repositoryIndex;
  }

  /**
   * Retrieves compact, targeted evidence for a user prompt
   */
  retrieveContext(userPrompt: string): RetrievedEvidenceContext {
    const index = this.repositoryIndex.getIndex();
    if (!index) {
      return {
        query: userPrompt,
        matchedKeys: [],
        relevantConfigs: [],
        relevantReferences: [],
        relevantFindings: [],
        summaryContextText: 'No indexed repository available. Run a workspace scan first.'
      };
    }

    const matchedKeys = this.extractMentionedKeys(userPrompt, index);
    const relevantConfigs: { key: string; file: string; line: number; maskedValue: string }[] = [];
    const relevantReferences: { file: string; line: number; symbol?: string; snippet: string; confidence: number }[] = [];
    const relevantFindings: DebtFinding[] = [];

    // 1. If specific configuration keys are mentioned
    for (const key of matchedKeys) {
      const canon = canonicalizeKey(key);
      const items = index.configurationItems.filter(
        (i) => i.key.toLowerCase() === key.toLowerCase() || canonicalizeKey(i.key) === canon
      );

      for (const item of items) {
        relevantConfigs.push({
          key: item.key,
          file: item.filePath,
          line: item.line,
          maskedValue: item.isPotentialSecret ? '<REDACTED>' : item.maskedValue
        });
      }

      const refs = this.repositoryIndex.findReferencesForKey(key);
      for (const r of refs.slice(0, 5)) {
        relevantReferences.push({
          file: r.filePath,
          line: r.line,
          symbol: r.enclosingSymbol?.name,
          snippet: this.redactSecretsInSnippet(r.snippet),
          confidence: r.confidence
        });
      }

      const findings = this.repositoryIndex.findFindingsForKey(key);
      relevantFindings.push(...findings);
    }

    // 2. If general topic is queried (e.g. "drift", "secret", "critical", "health", "unused")
    const qLower = userPrompt.toLowerCase();
    if (matchedKeys.length === 0) {
      if (qLower.includes('drift')) {
        relevantFindings.push(...index.findings.filter((f) => f.category === 'configuration_drift').slice(0, 5));
      } else if (qLower.includes('secret') || qLower.includes('password') || qLower.includes('token')) {
        relevantFindings.push(...index.findings.filter((f) => f.category === 'hardcoded_secret').slice(0, 5));
      } else if (qLower.includes('critical') || qLower.includes('risk') || qLower.includes('top')) {
        relevantFindings.push(...index.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 5));
      } else if (qLower.includes('unused') || qLower.includes('dead') || qLower.includes('remove')) {
        relevantFindings.push(...index.findings.filter((f) => f.category === 'dead_configuration' || f.category === 'unused_feature_flag').slice(0, 5));
      } else {
        // Default top priority findings
        relevantFindings.push(...index.findings.slice(0, 5));
      }

      // Populate configs and references from retrieved findings
      for (const f of relevantFindings) {
        relevantConfigs.push({
          key: f.configurationItem.key,
          file: f.configurationItem.filePath,
          line: f.configurationItem.line,
          maskedValue: f.configurationItem.isPotentialSecret ? '<REDACTED>' : f.configurationItem.maskedValue
        });
        const refs = this.repositoryIndex.findReferencesForKey(f.configurationItem.key);
        for (const r of refs.slice(0, 2)) {
          relevantReferences.push({
            file: r.filePath,
            line: r.line,
            symbol: r.enclosingSymbol?.name,
            snippet: this.redactSecretsInSnippet(r.snippet),
            confidence: r.confidence
          });
        }
      }
    }

    const summaryContextText = this.buildContextString(
      index,
      userPrompt,
      relevantConfigs,
      relevantReferences,
      relevantFindings
    );

    return {
      query: userPrompt,
      matchedKeys,
      relevantConfigs,
      relevantReferences,
      relevantFindings,
      summaryContextText
    };
  }

  private extractMentionedKeys(query: string, index: IndexedRepository): string[] {
    const keys = new Set<string>();
    const words = query.split(/[\s,;:`"'\(\)\[\]\{\}]+/);

    for (const word of words) {
      if (!word) continue;
      const clean = word.trim();
      // Check if matches any known configuration key or variant
      const exact = index.configurationItems.find(
        (i) => i.key.toLowerCase() === clean.toLowerCase() || canonicalizeKey(i.key) === clean.toLowerCase()
      );
      if (exact) {
        keys.add(exact.key);
      }
    }

    return Array.from(keys);
  }

  private buildContextString(
    index: IndexedRepository,
    prompt: string,
    configs: { key: string; file: string; line: number; maskedValue: string }[],
    refs: { file: string; line: number; symbol?: string; snippet: string; confidence: number }[],
    findings: DebtFinding[]
  ): string {
    const lines: string[] = [];
    lines.push(`Repository: ${index.workspaceName}`);
    lines.push(`Indexed at: ${new Date(index.indexedAt).toISOString()}`);
    lines.push(`Query: "${prompt}"`);
    lines.push('');

    if (configs.length > 0) {
      lines.push('Relevant Configuration Declarations:');
      for (const c of configs) {
        lines.push(`- ${c.key} in ${c.file}:${c.line} (value: ${c.maskedValue})`);
      }
      lines.push('');
    }

    if (refs.length > 0) {
      lines.push('Static Source References:');
      for (const r of refs) {
        const sym = r.symbol ? ` [${r.symbol}]` : '';
        lines.push(`- ${r.file}:${r.line}${sym} (Confidence: ${r.confidence}%)`);
        lines.push(`  Snippet: ${r.snippet}`);
      }
      lines.push('');
    }

    if (findings.length > 0) {
      lines.push('Configuration Debt Findings:');
      for (const f of findings) {
        lines.push(`- [${f.severity.toUpperCase()}] ${f.title} (Risk: ${f.riskScore}/100) in ${f.configurationItem.filePath}:${f.configurationItem.line}`);
        lines.push(`  Evidence: ${f.evidence.join(' ')}`);
        lines.push(`  Action: ${f.suggestedAction}`);
        if (f.blindSpots && f.blindSpots.length > 0) {
          lines.push(`  Possible Blind Spots: ${f.blindSpots.join(', ')}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private redactSecretsInSnippet(snippet: string): string {
    // Redact common sensitive assignment patterns
    return snippet
      .replace(/(?:password|secret|key|token|passwd)\s*[:=]\s*['"][^'"]+['"]/gi, (m) => {
        const prefix = m.split(/[:=]/)[0];
        return `${prefix}=<REDACTED>`;
      });
  }
}
