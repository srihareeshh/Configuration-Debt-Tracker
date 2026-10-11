/**
 * Configuration Debt Tracker - Targeted Context Retrieval Engine (RAG)
 * Extracts targeted evidence from the repository index for a user query.
 * Supports configuration lookup, static references, symbol search, BM25 lexical ranking,
 * and architectural documentation.
 * Strictly guarantees ZERO plaintext secret leakage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DebtFinding } from '../../models/finding';
import { PromptBuilder } from '../../ai/promptBuilder';
import { IndexedRepository, RepositoryIndex } from '../index/repositoryIndex';
import { canonicalizeKey } from '../references/normalizedKeyResolver';

export interface RelevantSourceSnippet {
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  symbolKind?: string;
  snippet: string;
  score: number;
}

export interface RetrievedEvidenceContext {
  query: string;
  matchedKeys: string[];
  relevantConfigs: { key: string; file: string; line: number; maskedValue: string }[];
  relevantReferences: { file: string; line: number; symbol?: string; snippet: string; confidence: number }[];
  relevantFindings: DebtFinding[];
  relevantSnippets: RelevantSourceSnippet[];
  matchedSymbols: { name: string; kind: string; file: string; line: number }[];
  readmeExcerpt?: string;
  summaryContextText: string;
  isIndexAvailable: boolean;
}

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does',
  'explain', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on',
  'or', 'show', 'tell', 'that', 'the', 'this', 'to', 'what', 'when', 'where', 'which',
  'who', 'why', 'with', 'you', 'your'
]);

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
        relevantSnippets: [],
        matchedSymbols: [],
        isIndexAvailable: false,
        summaryContextText: 'No indexed repository available. Run a workspace scan first to index configurations and source code.'
      };
    }

    const matchedKeys = this.extractMentionedKeys(userPrompt, index);
    const relevantConfigs: { key: string; file: string; line: number; maskedValue: string }[] = [];
    const relevantReferences: { file: string; line: number; symbol?: string; snippet: string; confidence: number }[] = [];
    const relevantFindings: DebtFinding[] = [];
    const matchedSymbols: { name: string; kind: string; file: string; line: number }[] = [];
    const relevantSnippets: RelevantSourceSnippet[] = [];

    // 1. Configuration-centric retrieval
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
      for (const r of refs) {
        relevantReferences.push({
          file: r.filePath,
          line: r.line,
          symbol: r.enclosingSymbol?.name,
          snippet: this.redactSnippet(r.snippet),
          confidence: r.confidence
        });
      }

      const findings = this.repositoryIndex.findFindingsForKey(key);
      relevantFindings.push(...findings);
    }

    // 2. Symbol & Code-centric retrieval (for general architectural/source questions)
    const queryTokens = this.tokenizeQuery(userPrompt);
    const codeSnippets = this.retrieveRelevantCodeSnippets(userPrompt, queryTokens, index);
    relevantSnippets.push(...codeSnippets);

    // Collect matched symbols from snippets
    for (const snip of relevantSnippets) {
      if (snip.symbolName && snip.symbolKind) {
        matchedSymbols.push({
          name: snip.symbolName,
          kind: snip.symbolKind,
          file: snip.filePath,
          line: snip.startLine
        });
      }
    }

    // 3. Topic fallback if neither specific keys nor code snippets matched
    const qLower = userPrompt.toLowerCase();
    if (matchedKeys.length === 0 && relevantSnippets.length === 0) {
      if (qLower.includes('drift')) {
        relevantFindings.push(...index.findings.filter((f) => f.category === 'configuration_drift').slice(0, 5));
      } else if (qLower.includes('secret') || qLower.includes('password') || qLower.includes('token')) {
        relevantFindings.push(...index.findings.filter((f) => f.category === 'hardcoded_secret').slice(0, 5));
      } else if (qLower.includes('critical') || qLower.includes('risk') || qLower.includes('top')) {
        relevantFindings.push(...index.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 5));
      } else if (qLower.includes('unused') || qLower.includes('dead') || qLower.includes('remove')) {
        relevantFindings.push(...index.findings.filter((f) => f.category === 'dead_configuration' || f.category === 'unused_feature_flag').slice(0, 5));
      } else if (qLower.includes('health') || qLower.includes('score')) {
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
        for (const r of refs.slice(0, 5)) {
          relevantReferences.push({
            file: r.filePath,
            line: r.line,
            symbol: r.enclosingSymbol?.name,
            snippet: this.redactSnippet(r.snippet),
            confidence: r.confidence
          });
        }
      }
    }

    // 4. README / Repository Documentation excerpt
    let readmeExcerpt: string | undefined;
    if (
      qLower.includes('architecture') ||
      qLower.includes('overview') ||
      qLower.includes('summarize') ||
      qLower.includes('new to') ||
      qLower.includes('start') ||
      qLower.includes('project')
    ) {
      readmeExcerpt = this.readReadmeExcerpt(index.workspacePath);
    }

    const summaryContextText = this.buildContextString(
      index,
      userPrompt,
      relevantConfigs,
      relevantReferences,
      relevantFindings,
      relevantSnippets,
      readmeExcerpt
    );

    return {
      query: userPrompt,
      matchedKeys,
      relevantConfigs,
      relevantReferences,
      relevantFindings,
      relevantSnippets,
      matchedSymbols,
      readmeExcerpt,
      isIndexAvailable: true,
      summaryContextText
    };
  }

  private extractMentionedKeys(query: string, index: IndexedRepository): string[] {
    const keys = new Set<string>();
    const words = query.split(/[\s,;:`"'\(\)\[\]\{\}]+/);

    for (const word of words) {
      if (!word) continue;
      const clean = word.trim();
      const canon = canonicalizeKey(clean);

      const exact = index.configurationItems.find(
        (i) =>
          i.key.toLowerCase() === clean.toLowerCase() ||
          canonicalizeKey(i.key) === clean.toLowerCase() ||
          canonicalizeKey(i.key) === canon
      );
      if (exact) {
        keys.add(exact.key);
      }
    }

    return Array.from(keys);
  }

  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .split(/[^a-z0-9_$]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  }

  /**
   * Lexical & Symbol ranking to retrieve relevant source snippets
   */
  private retrieveRelevantCodeSnippets(
    _query: string,
    tokens: string[],
    index: IndexedRepository
  ): RelevantSourceSnippet[] {
    const snippets: RelevantSourceSnippet[] = [];
    if (!index.sourceFiles || index.sourceFiles.size === 0) {
      return snippets;
    }

    const scoredFiles: { file: string; score: number }[] = [];

    for (const [filePath, sourceFile] of index.sourceFiles.entries()) {
      let score = 0;
      const pathLower = filePath.toLowerCase();

      // Path token matches
      for (const t of tokens) {
        if (pathLower.includes(t)) {
          score += 25;
        }
      }

      // Symbol name matches
      for (const sym of sourceFile.symbols) {
        const symLower = sym.name.toLowerCase();
        for (const t of tokens) {
          if (symLower === t) {
            score += 35;
          } else if (symLower.includes(t)) {
            score += 15;
          }
        }
      }

      // Keyword line matches
      for (const line of sourceFile.lines) {
        if (line.isPureComment) continue;
        const lineText = line.codeOnlyText.toLowerCase();
        for (const t of tokens) {
          if (lineText.includes(t)) {
            score += 2;
          }
        }
      }

      if (score > 0) {
        scoredFiles.push({ file: filePath, score });
      }
    }

    scoredFiles.sort((a, b) => b.score - a.score);

    // Pick top 3 files and extract relevant code portions
    for (const item of scoredFiles.slice(0, 3)) {
      const sourceFile = index.sourceFiles.get(item.file);
      if (!sourceFile) continue;

      // Check if a symbol defined in this file matches tokens
      const matchedSym = sourceFile.symbols.find((s) =>
        tokens.some((t) => s.name.toLowerCase().includes(t))
      );

      let start = 1;
      let end = Math.min(sourceFile.lines.length, 50);

      if (matchedSym) {
        start = Math.max(1, matchedSym.startLine - 2);
        end = Math.min(sourceFile.lines.length, matchedSym.endLine + 5, start + 60);
      } else {
        // Find line with highest token density
        let bestLine = 1;
        let maxHits = 0;
        sourceFile.lines.forEach((l) => {
          const hits = tokens.filter((t) => l.originalText.toLowerCase().includes(t)).length;
          if (hits > maxHits) {
            maxHits = hits;
            bestLine = l.lineNumber;
          }
        });
        start = Math.max(1, bestLine - 5);
        end = Math.min(sourceFile.lines.length, start + 50);
      }

      const snippetLines = sourceFile.lines
        .filter((l) => l.lineNumber >= start && l.lineNumber <= end)
        .map((l) => `${l.lineNumber}: ${l.originalText}`)
        .join('\n');

      snippets.push({
        filePath: sourceFile.filePath,
        language: sourceFile.language,
        startLine: start,
        endLine: end,
        symbolName: matchedSym?.name,
        symbolKind: matchedSym?.kind,
        snippet: this.redactSnippet(snippetLines),
        score: item.score
      });
    }

    return snippets;
  }

  private readReadmeExcerpt(workspacePath: string): string | undefined {
    try {
      const readmePath = path.join(workspacePath, 'README.md');
      if (fs.existsSync(readmePath)) {
        const text = fs.readFileSync(readmePath, 'utf8');
        // Take first 120 lines
        const lines = text.split('\n').slice(0, 80).join('\n');
        return this.redactSnippet(lines);
      }
    } catch {
      // Ignored if unreadable
    }
    return undefined;
  }

  private buildContextString(
    index: IndexedRepository,
    prompt: string,
    configs: { key: string; file: string; line: number; maskedValue: string }[],
    refs: { file: string; line: number; symbol?: string; snippet: string; confidence: number }[],
    findings: DebtFinding[],
    snippets: RelevantSourceSnippet[],
    readmeExcerpt?: string
  ): string {
    const lines: string[] = [];
    lines.push(`Repository: ${index.workspaceName}`);
    lines.push(`Indexed at: ${new Date(index.indexedAt).toISOString()}`);
    lines.push(`Query: "${prompt}"`);
    lines.push('');

    if (readmeExcerpt) {
      lines.push('Repository Documentation & Architecture (README Excerpt):');
      lines.push(readmeExcerpt);
      lines.push('');
    }

    if (configs.length > 0) {
      lines.push('Relevant Configuration Declarations:');
      for (const c of configs) {
        lines.push(`- ${c.key} in ${c.file}:${c.line} (value: ${c.maskedValue})`);
      }
      lines.push('');
    }

    if (refs.length > 0) {
      lines.push(`Static Source References (Total references identified: ${refs.length}):`);
      for (const r of refs) {
        const sym = r.symbol ? ` [${r.symbol}]` : '';
        lines.push(`- ${r.file}:${r.line}${sym} (Confidence: ${r.confidence}%)`);
        lines.push(`  Snippet: ${r.snippet}`);
      }
      lines.push('');
    }

    if (snippets.length > 0) {
      lines.push('Retrieved Source Code Snippets:');
      for (const s of snippets) {
        const symInfo = s.symbolName ? ` [${s.symbolKind || 'symbol'} ${s.symbolName}]` : '';
        lines.push(`--- File: ${s.filePath}:${s.startLine}-${s.endLine} (${s.language})${symInfo} ---`);
        lines.push(s.snippet);
        lines.push('---');
      }
      lines.push('');
    }

    if (findings.length > 0) {
      lines.push('Configuration Debt Findings:');
      for (const f of findings) {
        lines.push(
          `- [${f.severity.toUpperCase()}] ${f.title} (Risk: ${f.riskScore}/100) in ${f.configurationItem.filePath}:${f.configurationItem.line}`
        );
        lines.push(`  Evidence: ${f.evidence.join(' ')}`);
        lines.push(`  Action: ${f.suggestedAction}`);
        if (f.blindSpots && f.blindSpots.length > 0) {
          lines.push(`  Possible Blind Spots: ${f.blindSpots.join(', ')}`);
        }
      }
      lines.push('');
    }

    if (
      configs.length === 0 &&
      refs.length === 0 &&
      snippets.length === 0 &&
      findings.length === 0 &&
      !readmeExcerpt
    ) {
      lines.push('Notice: No specific indexed source or configuration evidence matching this query was detected.');
    }

    return lines.join('\n');
  }

  private redactSnippet(text: string): string {
    return PromptBuilder.redactSensitiveData(text);
  }
}
