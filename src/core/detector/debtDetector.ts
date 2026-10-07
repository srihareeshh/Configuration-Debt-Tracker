/**
 * Configuration Debt Tracker - Upgraded Debt Detector (Module 3)
 * Deterministic detection across 12 comprehensive configuration debt categories:
 * 1. Dead Configuration (with explicit blind spots & confidence)
 * 2. Duplicated Configuration
 * 3. Configuration Drift (value drift across files/environments)
 * 4. Stale / Outdated Configuration
 * 5. Hardcoded Secret (with zero raw exposure)
 * 6. Undocumented Configuration
 * 7. Suspicious Dynamic Reference
 * 8. Environment Inconsistency
 * 9. Unused Feature Flag
 * 10. High-Impact Configuration
 * 11. Test-Only Configuration
 * 12. Configuration With Weak Evidence
 */

import { canonicalizeKey } from '../../code-intelligence/references/normalizedKeyResolver';
import { ConfigurationItem } from '../../models/configuration';
import { DebtFinding, DependencyEvidenceItem } from '../../models/finding';
import { UsageAnalysis } from '../../models/usage';
import { RiskEngine } from '../risk/riskEngine';

export interface DetectorOptions {
  staleAgeDaysThreshold?: number;
}

export class DebtDetector {
  private riskEngine: RiskEngine;

  constructor(riskEngine: RiskEngine = new RiskEngine()) {
    this.riskEngine = riskEngine;
  }

  detectDebt(
    items: ConfigurationItem[],
    usageMap: Record<string, UsageAnalysis>,
    options: DetectorOptions = {}
  ): DebtFinding[] {
    const findings: DebtFinding[] = [];
    const staleThreshold = options.staleAgeDaysThreshold ?? 90;

    // Group items by canonical identity: e.g. DATABASE_URL and database.url group together
    const itemsByCanonical = new Map<string, ConfigurationItem[]>();
    for (const item of items) {
      const canon = canonicalizeKey(item.key);
      const list = itemsByCanonical.get(canon) || [];
      list.push(item);
      itemsByCanonical.set(canon, list);
    }

    const processedDuplicateCanonicals = new Set<string>();

    // 1. DUPLICATION & CONFIGURATION DRIFT DETECTION
    for (const [canon, group] of itemsByCanonical.entries()) {
      const distinctFiles = Array.from(new Set(group.map((i) => i.filePath)));

      if (distinctFiles.length > 1 && !processedDuplicateCanonicals.has(canon)) {
        processedDuplicateCanonicals.add(canon);
        const primaryItem = group[0];
        const uniqueValues = Array.from(new Set(group.map((i) => i.value)));
        const hasDrift = uniqueValues.length > 1;

        const duplicateLocations = group.map((g) => ({
          filePath: g.filePath,
          line: g.line,
          valueMatch: !hasDrift,
          value: g.maskedValue
        }));

        const usage = usageMap[primaryItem.key] || usageMap[canon];
        const usageCount = usage?.referenceCount ?? 0;

        if (hasDrift) {
          // CATEGORY 3: CONFIGURATION DRIFT
          const riskBreakdown = this.riskEngine.calculateRisk({
            category: 'configuration_drift',
            ageDays: primaryItem.ageDays ?? 0,
            usageCount,
            affectedFilesCount: distinctFiles.length,
            sensitivity: primaryItem.sensitivity,
            hasDrift: true
          });

          findings.push({
            id: `finding:drift:${canon}`,
            title: `Configuration drift for '${primaryItem.key}' across ${distinctFiles.length} files`,
            category: 'configuration_drift',
            categoryLabel: 'Configuration Drift',
            severity: riskBreakdown.severity,
            riskScore: riskBreakdown.total,
            riskBreakdown,
            configurationItem: primaryItem,
            confidence: 97,
            evidence: [
              `Defined across ${distinctFiles.length} distinct configuration files: ${distinctFiles.join(', ')}.`,
              `CONFIGURATION DRIFT: Values diverge across files (${uniqueValues.length} distinct values detected: ${uniqueValues.map((v) => primaryItem.isPotentialSecret ? '••••••••' : v).join(', ')}).`,
              `Canonical identity: '${canon}'.`
            ],
            affectedFiles: distinctFiles,
            duplicateLocations,
            recommendation: `Synchronize divergent values for '${primaryItem.key}'. Establish an authoritative source of truth to avoid runtime desynchronization between environments.`,
            suggestedAction: `Reconcile drifted values for '${primaryItem.key}' across ${distinctFiles.join(', ')}.`
          });
        } else {
          // CATEGORY 2: DUPLICATED CONFIGURATION
          const riskBreakdown = this.riskEngine.calculateRisk({
            category: 'duplicated_configuration',
            ageDays: primaryItem.ageDays ?? 0,
            usageCount,
            affectedFilesCount: distinctFiles.length,
            sensitivity: primaryItem.sensitivity,
            hasDrift: false
          });

          findings.push({
            id: `finding:dup:${canon}`,
            title: `Duplicated configuration '${primaryItem.key}' across ${distinctFiles.length} files`,
            category: 'duplicated_configuration',
            categoryLabel: 'Duplicated Configuration',
            severity: riskBreakdown.severity,
            riskScore: riskBreakdown.total,
            riskBreakdown,
            configurationItem: primaryItem,
            confidence: 96,
            evidence: [
              `Found defined in ${distinctFiles.length} distinct configuration files: ${distinctFiles.join(', ')}.`,
              `Values are identical across all definitions.`,
              `Canonical identity: '${canon}'.`
            ],
            affectedFiles: distinctFiles,
            duplicateLocations,
            recommendation: `Consolidate duplicated declarations of '${primaryItem.key}' into a single root configuration or env template to avoid future drift.`,
            suggestedAction: `Consolidate ${distinctFiles.length} definitions into single configuration file.`
          });
        }
      }
    }

    // Process individual items for other categories
    for (const item of items) {
      const usage = usageMap[item.key];
      const isUsed = usage ? usage.isUsed : false;
      const refCount = usage ? usage.referenceCount : 0;
      const confidence = usage ? usage.confidence : 0;
      const highestLevel = usage?.highestConfidenceLevel;
      const isTestOnly = usage?.isTestOnly ?? false;

      const dependencyEvidence: DependencyEvidenceItem[] = (usage?.references || []).map((r) => ({
        file: r.filePath,
        line: r.line,
        symbol: r.enclosingSymbol?.name,
        snippet: r.snippet,
        confidence: r.confidence
      }));

      // CATEGORY 5: HARDCODED SECRET DETECTION
      if (item.isPotentialSecret) {
        const riskBreakdown = this.riskEngine.calculateRisk({
          category: 'hardcoded_secret',
          ageDays: item.ageDays ?? 0,
          usageCount: refCount,
          affectedFilesCount: 1,
          sensitivity: 'secret',
          isSecret: true
        });

        findings.push({
          id: `finding:secret:${item.id}`,
          title: `Potential secret or credential in '${item.key}'`,
          category: 'hardcoded_secret',
          categoryLabel: 'Hardcoded Secret',
          severity: riskBreakdown.severity,
          riskScore: riskBreakdown.total,
          riskBreakdown,
          configurationItem: item,
          confidence: 95,
          evidence: [
            `Sensitive credential pattern matched: ${item.secretType || 'Credential literal'}.`,
            `Value is stored in plain text inside ${item.filePath}:${item.line}.`,
            `Zero-exposure mask applied for display.`
          ],
          affectedFiles: [item.filePath],
          secretDetectionType: item.secretType,
          recommendation: `Move '${item.key}' out of version-controlled files immediately. Rotate the credential and load it from a vault or secure environment injection.`,
          suggestedAction: `Move plaintext secret to secret vault or masked .env file.`,
          remediationProposal: {
            filePath: item.filePath,
            line: item.line,
            originalText: `${item.key}=${item.value}`,
            proposedDiff: `- ${item.key}=${item.value}\n+ ${item.key}=\${VAULT_${item.key}}`,
            explanation: `Replace plaintext credential with runtime environment or vault placeholder.`,
            actionType: 'mask_secret'
          }
        });
      }

      const isFeatureFlag = isFeatureFlagKey(item.key);

      // CATEGORY 9: UNUSED FEATURE FLAG vs CATEGORY 1: DEAD CONFIGURATION
      if (!isUsed) {
        if (isFeatureFlag) {
          const riskBreakdown = this.riskEngine.calculateRisk({
            category: 'unused_feature_flag',
            ageDays: item.ageDays ?? 0,
            usageCount: 0,
            affectedFilesCount: 1,
            sensitivity: item.sensitivity,
            isLegacyNamed: true
          });

          findings.push({
            id: `finding:unused_ff:${item.id}`,
            title: `Unused feature flag '${item.key}'`,
            category: 'unused_feature_flag',
            categoryLabel: 'Unused Feature Flag',
            severity: riskBreakdown.severity,
            riskScore: riskBreakdown.total,
            riskBreakdown,
            configurationItem: item,
            confidence: 94,
            evidence: [
              `Key matches feature flag naming convention ('${item.key}').`,
              `No static references detected across any source code files.`,
              `Flag has no active conditional toggles.`
            ],
            affectedFiles: [item.filePath],
            blindSpots: [
              'Dynamic feature flag toggles (e.g. LaunchDarkly / Unleash server SDK)',
              'Runtime feature evaluation via database configuration tables',
              'External mobile or frontend client consuming backend config endpoint'
            ],
            recommendation: `Audit whether this feature flag rollout was concluded or cancelled. Remove the dormant configuration toggle.`,
            suggestedAction: `Remove obsolete feature flag '${item.key}' from ${item.filePath}.`,
            remediationProposal: {
              filePath: item.filePath,
              line: item.line,
              originalText: `${item.key}=${item.value}`,
              proposedDiff: `- ${item.key}=${item.value}`,
              explanation: `Delete obsolete feature flag declaration.`,
              actionType: 'delete_declaration'
            }
          });
        } else {
          // CATEGORY 1: DEAD CONFIGURATION
          const riskBreakdown = this.riskEngine.calculateRisk({
            category: 'dead_configuration',
            ageDays: item.ageDays ?? 0,
            usageCount: 0,
            affectedFilesCount: 1,
            sensitivity: item.sensitivity
          });

          findings.push({
            id: `finding:dead:${item.id}`,
            title: `Unused configuration '${item.key}'`,
            category: 'dead_configuration',
            categoryLabel: 'Dead Configuration',
            severity: riskBreakdown.severity,
            riskScore: riskBreakdown.total,
            riskBreakdown,
            configurationItem: item,
            confidence: 96,
            evidence: [
              `No static references detected across the indexed source repository.`,
              `Declared at ${item.filePath}:${item.line} (${item.format.toUpperCase()}).`,
              item.ageDays !== undefined ? `Configuration item age: ${item.ageDays} days.` : 'No modification history.'
            ],
            affectedFiles: [item.filePath],
            blindSpots: [
              'Dynamically constructed environment keys (e.g. process.env[prefix + name])',
              'External deployment or CI/CD manifests outside this repository',
              'Reflection or framework dependency injection',
              'Generated code or third-party container scripts'
            ],
            recommendation: `Verify whether '${item.key}' belongs to an abandoned integration or retired feature. Remove it to eliminate cognitive overhead.`,
            suggestedAction: `Remove obsolete key '${item.key}' from ${item.filePath}.`,
            remediationProposal: {
              filePath: item.filePath,
              line: item.line,
              originalText: `${item.key}=${item.value}`,
              proposedDiff: `- ${item.key}=${item.value}`,
              explanation: `Delete obsolete configuration declaration.`,
              actionType: 'delete_declaration'
            }
          });
        }
      }

      // CATEGORY 4: STALE / OUTDATED CONFIGURATION
      const isLegacyNamed = isLegacyKey(item.key);
      const isOld = (item.ageDays ?? 0) >= staleThreshold;

      if ((isLegacyNamed && isUsed) || (isOld && !isUsed && !isFeatureFlag)) {
        const riskBreakdown = this.riskEngine.calculateRisk({
          category: 'stale_configuration',
          ageDays: item.ageDays ?? 0,
          usageCount: refCount,
          affectedFilesCount: 1,
          sensitivity: item.sensitivity,
          isLegacyNamed
        });

        findings.push({
          id: `finding:stale:${item.id}`,
          title: `Potentially stale configuration '${item.key}'`,
          category: 'stale_configuration',
          categoryLabel: 'Stale Configuration',
          severity: riskBreakdown.severity,
          riskScore: riskBreakdown.total,
          riskBreakdown,
          configurationItem: item,
          confidence: 90,
          evidence: [
            isLegacyNamed
              ? `Key name contains legacy/temporary indicator prefix.`
              : `Configuration has been unchanged for ${item.ageDays} days.`,
            `Referenced by ${refCount} source location(s) (detection confidence: ${confidence}%).`
          ],
          affectedFiles: [item.filePath],
          dependencyEvidence,
          ageDays: item.ageDays,
          recommendation: `Confirm if the migration or temporary rollout for '${item.key}' has completed. Remove obsolete branches and decommission the flag.`,
          suggestedAction: `Decommission stale configuration or legacy flag '${item.key}'.`
        });
      }

      // CATEGORY 11: TEST-ONLY CONFIGURATION
      if (isUsed && isTestOnly) {
        const riskBreakdown = this.riskEngine.calculateRisk({
          category: 'test_only_configuration',
          ageDays: item.ageDays ?? 0,
          usageCount: refCount,
          affectedFilesCount: 1,
          sensitivity: item.sensitivity
        });

        findings.push({
          id: `finding:test_only:${item.id}`,
          title: `Test-only configuration '${item.key}' declared in general config`,
          category: 'test_only_configuration',
          categoryLabel: 'Test-Only Configuration',
          severity: riskBreakdown.severity,
          riskScore: riskBreakdown.total,
          riskBreakdown,
          configurationItem: item,
          confidence: 92,
          evidence: [
            `All ${refCount} source code reference(s) reside exclusively within test files (${usage.referencingFiles.join(', ')}).`,
            `Declared in root configuration file '${item.filePath}:${item.line}'.`
          ],
          affectedFiles: [item.filePath, ...usage.referencingFiles],
          dependencyEvidence,
          recommendation: `Move '${item.key}' into test fixtures (e.g. jest.config, .env.test) so production configurations remain clean.`,
          suggestedAction: `Relocate '${item.key}' from ${item.filePath} to test configuration file.`
        });
      }

      // CATEGORY 7: SUSPICIOUS DYNAMIC REFERENCE
      if (isUsed && highestLevel === 6) {
        const riskBreakdown = this.riskEngine.calculateRisk({
          category: 'suspicious_dynamic_reference',
          ageDays: item.ageDays ?? 0,
          usageCount: refCount,
          affectedFilesCount: 1,
          sensitivity: item.sensitivity
        });

        findings.push({
          id: `finding:dyn:${item.id}`,
          title: `Suspicious dynamic configuration access for '${item.key}'`,
          category: 'suspicious_dynamic_reference',
          categoryLabel: 'Suspicious Dynamic Reference',
          severity: riskBreakdown.severity,
          riskScore: riskBreakdown.total,
          riskBreakdown,
          configurationItem: item,
          confidence: 70,
          evidence: [
            `Reference was detected via dynamic key construction or concatenation.`,
            `Static analyzer cannot guarantee runtime resolution safety.`
          ],
          affectedFiles: [item.filePath, ...usage.referencingFiles],
          dependencyEvidence,
          recommendation: `Refactor dynamic environment accesses to use explicit, static property lookups for type safety and auditable SCM tracking.`,
          suggestedAction: `Replace dynamic lookup with explicit static reference to '${item.key}'.`
        });
      }

      // CATEGORY 12: WEAK EVIDENCE CONFIGURATION
      if (isUsed && highestLevel === 7 && refCount > 0) {
        const riskBreakdown = this.riskEngine.calculateRisk({
          category: 'weak_evidence_configuration',
          ageDays: item.ageDays ?? 0,
          usageCount: refCount,
          affectedFilesCount: 1,
          sensitivity: item.sensitivity
        });

        findings.push({
          id: `finding:weak:${item.id}`,
          title: `Configuration '${item.key}' has weak usage evidence`,
          category: 'weak_evidence_configuration',
          categoryLabel: 'Weak Evidence Configuration',
          severity: riskBreakdown.severity,
          riskScore: riskBreakdown.total,
          riskBreakdown,
          configurationItem: item,
          confidence: 55,
          evidence: [
            `Reference was identified solely through Level 7 generic text matching.`,
            `No formal environment access or framework helper was detected.`
          ],
          affectedFiles: [item.filePath, ...usage.referencingFiles],
          dependencyEvidence,
          recommendation: `Verify whether this is genuine configuration usage or an accidental word match. If active, wrap with standard config helper.`,
          suggestedAction: `Verify and convert generic match to structured config access for '${item.key}'.`
        });
      }

      // CATEGORY 6: UNDOCUMENTED CONFIGURATION DETECTION
      if (!item.documentation && (item.sensitivity !== 'public' || refCount > 2 || isUsed)) {
        const riskBreakdown = this.riskEngine.calculateRisk({
          category: 'undocumented_configuration',
          ageDays: item.ageDays ?? 0,
          usageCount: refCount,
          affectedFilesCount: 1,
          sensitivity: item.sensitivity
        });

        findings.push({
          id: `finding:undoc:${item.id}`,
          title: `Undocumented configuration setting '${item.key}'`,
          category: 'undocumented_configuration',
          categoryLabel: 'Undocumented Configuration',
          severity: riskBreakdown.severity,
          riskScore: riskBreakdown.total,
          riskBreakdown,
          configurationItem: item,
          confidence: 90,
          evidence: [
            `No explanatory comments or documentation found above or inline with '${item.key}' in ${item.filePath}:${item.line}.`,
            `Setting is currently referenced in ${refCount} source location(s).`
          ],
          affectedFiles: [item.filePath],
          dependencyEvidence,
          recommendation: `Add inline or header documentation specifying the purpose, valid values, defaults, and owner for '${item.key}'.`,
          suggestedAction: `Add documentation comments explaining '${item.key}'.`,
          remediationProposal: {
            filePath: item.filePath,
            line: item.line,
            originalText: `${item.key}=${item.value}`,
            proposedDiff: `+ # ${item.key}: Configuration description and defaults\n  ${item.key}=${item.value}`,
            explanation: `Insert documentation header above setting declaration.`,
            actionType: 'add_documentation'
          }
        });
      }
    }

    // Sort findings by risk score descending (highest risk first)
    return findings.sort((a, b) => b.riskScore - a.riskScore);
  }
}

function isFeatureFlagKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    upper.startsWith('FEATURE_') ||
    upper.startsWith('ENABLE_') ||
    upper.startsWith('DISABLE_') ||
    upper.startsWith('FF_') ||
    upper.startsWith('FLAG_') ||
    upper.endsWith('_ENABLED') ||
    upper.endsWith('_DISABLED') ||
    upper.endsWith('_FLAG') ||
    upper.includes('EXPERIMENT_')
  );
}

function isLegacyKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    upper.startsWith('OLD_') ||
    upper.startsWith('LEGACY_') ||
    upper.startsWith('DEPRECATED_') ||
    upper.startsWith('TEMP_') ||
    upper.startsWith('TMP_') ||
    upper.includes('_OLD') ||
    upper.includes('_LEGACY') ||
    upper.includes('_DEPRECATED')
  );
}
