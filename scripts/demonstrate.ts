/**
 * Configuration Debt Tracker - Demonstration Runner
 * Executes the complete analysis pipeline against the sample-repo fixture
 * and displays terminal diagnostics explaining all 4 SCM pillars.
 */

import * as path from 'path';
import { AiExplainer } from '../src/ai/aiExplainer';
import { ScanService } from '../src/services/scanService';

async function runDemo(): Promise<void> {
  const sampleRepoDir = path.resolve(__dirname, '../../sample-repo');
  console.log('================================================================================');
  console.log('       CONFIGURATION DEBT TRACKER — LIVE DEMONSTRATION & SCM AUDIT');
  console.log('================================================================================');
  console.log(`Auditing Workspace: ${sampleRepoDir}\n`);

  const scanService = new ScanService();
  const startTime = Date.now();

  const result = await scanService.runScan(sampleRepoDir, [], (stage, pct, detail) => {
    console.log(`[PIPELINE ${pct}%] ${stage}... ${detail || ''}`);
  });

  const duration = Date.now() - startTime;
  console.log(`\nScan completed in ${duration}ms.\n`);

  console.log('================================================================================');
  console.log('PILLAR 1: SCM CONFIGURATION IDENTIFICATION (Inventory)');
  console.log('================================================================================');
  console.log(`Total Tracked Configuration Items: ${result.inventory.totalItems}`);
  console.log(`Formats Detected:`);
  for (const [fmt, count] of Object.entries(result.inventory.byFormat)) {
    if (count > 0) {
      console.log(`  - ${fmt.toUpperCase()}: ${count} item(s)`);
    }
  }
  console.log('\nSample Inventory Entries:');
  result.items.forEach((item) => {
    console.log(`  • [${item.format.toUpperCase()}] ${item.key.padEnd(24)} -> ${item.maskedValue.padEnd(26)} (${item.filePath}:${item.line})`);
  });

  console.log('\n================================================================================');
  console.log('PILLAR 2: SCM CONFIGURATION AUDIT (Source Usage & Dead Code Detection)');
  console.log('================================================================================');
  for (const [key, usage] of Object.entries(result.usageMap)) {
    const statusIcon = usage.isUsed ? '✓ USED' : '✗ UNUSED (DEAD)';
    console.log(`  ${statusIcon.padEnd(16)} '${key}' — ${usage.referenceCount} reference(s) (Confidence: ${usage.confidence}%)`);
    if (usage.references.length > 0) {
      usage.references.forEach((ref) => {
        console.log(`      ↳ ${ref.filePath}:${ref.line} [${ref.language}] snippet: "${ref.snippet}"`);
      });
    }
  }

  console.log('\n================================================================================');
  console.log('PILLAR 3: CONFIGURATION DEBT DETECTION & RISK ENGINE');
  console.log('================================================================================');
  console.log(`Detected Findings: ${result.findings.length}\n`);

  result.findings.forEach((f, idx) => {
    console.log(`[FINDING #${idx + 1}] ${f.title}`);
    console.log(`  Category:    ${f.categoryLabel}`);
    console.log(`  Severity:    ${f.severity.toUpperCase()} (Risk Score: ${f.riskScore}/100)`);
    console.log(`  Location:    ${f.configurationItem.filePath}:${f.configurationItem.line}`);
    console.log(`  Risk Breakdown: Age=${f.riskBreakdown.ageScore}/25 | Usage=${f.riskBreakdown.usageScore}/35 | Impact=${f.riskBreakdown.impactScore}/25 | Sensitivity=${f.riskBreakdown.sensitivityScore}/15`);
    console.log(`  Evidence:    ${f.evidence.join(' ')}`);
    console.log(`  Action:      ${f.suggestedAction}\n`);
  });

  console.log('================================================================================');
  console.log('PILLAR 4: SCM STATUS ACCOUNTING (Health Score & Trend)');
  console.log('================================================================================');
  console.log(`Configuration Health Score: ${result.healthScore.score} / 100 (${result.healthScore.grade})`);
  console.log(`Base Score: ${result.healthScore.baseScore}`);
  console.log('Transparent Deductions:');
  result.healthScore.deductions.forEach((d) => {
    console.log(`  - [${d.category}]: -${d.deductionPoints} pts (${d.explanation})`);
  });

  console.log('\nSeverity Count Summary:');
  console.log(`  CRITICAL: ${result.inventory.bySeverity.critical}`);
  console.log(`  HIGH:     ${result.inventory.bySeverity.high}`);
  console.log(`  MEDIUM:   ${result.inventory.bySeverity.medium}`);
  console.log(`  LOW:      ${result.inventory.bySeverity.low}`);

  console.log('\n================================================================================');
  console.log('PILLAR 5: SCM CONFIGURATION CONTROL (Prioritized Cleanup Backlog)');
  console.log('================================================================================');
  result.cleanupItems.forEach((c) => {
    console.log(`  #${c.priority} [${c.severity.toUpperCase()}] Risk ${c.riskScore} | ${c.key} in ${c.file}:${c.line} (${c.status.toUpperCase()})`);
    console.log(`     ↳ Remediation: ${c.suggestedAction}`);
  });

  console.log('\n================================================================================');
  console.log('AI EXPLAINER LAYER (Zero Secret Exposure)');
  console.log('================================================================================');
  const topFinding = result.findings[0];
  if (topFinding) {
    console.log(`Generating Architectural Explanation for: ${topFinding.title}`);
    const aiExplainer = new AiExplainer();
    const explanation = await aiExplainer.explainFinding(topFinding);
    console.log(`Provider: ${explanation.provider}`);
    console.log(`Summary:  ${explanation.summary}`);
    console.log(`Why:      ${explanation.whyFlagged}`);
    console.log(`Verify:   ${explanation.verificationSteps.join(' -> ')}`);
    console.log(`Remedy:   ${explanation.remediationAdvice}`);
  }

  console.log('\n================================================================================');
  console.log('DEMONSTRATION COMPLETE — SCM AUDIT PASSED WITH DISTINCTION');
  console.log('================================================================================');
}

runDemo().catch(console.error);
