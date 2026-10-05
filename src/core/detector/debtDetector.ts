/**
 * Configuration Debt Tracker - Debt Detector (Module 3)
 * Deterministic detection across 5 core configuration debt categories:
 * 1. Dead Configuration
 * 2. Duplicated Configuration
 * 3. Outdated / Stale Configuration
 * 4. Hardcoded Secret
 * 5. Undocumented Configuration
 */

import { ConfigurationItem } from '../../models/configuration';
import { DebtFinding } from '../../models/finding';
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

  /**
   * Evaluates configuration items and source usage map to produce deterministic debt findings.
   */
  detectDebt(
    items: ConfigurationItem[],
    usageMap: Record<string, UsageAnalysis>,
    options: DetectorOptions = {}
  ): DebtFinding[] {
    const findings: DebtFinding[] = [];
    const staleThreshold = options.staleAgeDaysThreshold ?? 90;

    // Track processed duplicates to avoid creating duplicate findings for the same cluster
    const processedDuplicateKeys = new Set<string>();

    // Group items by normalized key to detect multi-file duplication
    const itemsByKey = new Map<string, ConfigurationItem[]>();
    for (const item of items) {
      const list = itemsByKey.get(item.key) || [];
      list.push(item);
      itemsByKey.set(item.key, list);
    }

    // 1. DUPLICATED CONFIGURATION DETECTION
    for (const [key, group] of itemsByKey.entries()) {
      // Duplication requires occurring in 2 or more distinct files
      const distinctFiles = Array.from(new Set(group.map((i) => i.filePath)));
      if (distinctFiles.length > 1 && !processedDuplicateKeys.has(key)) {
        processedDuplicateKeys.add(key);

        const primaryItem = group[0];
        const uniqueValues = Array.from(new Set(group.map((i) => i.value)));
        const hasDrift = uniqueValues.length > 1;

        const evidence: string[] = [
          `Found defined in ${distinctFiles.length} distinct configuration files: ${distinctFiles.join(', ')}.`,
          hasDrift
            ? `CONFIGURATION DRIFT: Values differ across files (${uniqueValues.length} distinct values detected).`
            : `Values are identical across all definitions.`
        ];

        const duplicateLocations = group.map((g) => ({
          filePath: g.filePath,
          line: g.line,
          valueMatch: !hasDrift
        }));

        const usage = usageMap[key];
        const usageCount = usage?.referenceCount ?? 0;

        const riskBreakdown = this.riskEngine.calculateRisk({
          category: 'duplicated_configuration',
          ageDays: primaryItem.ageDays ?? 0,
          usageCount,
          affectedFilesCount: distinctFiles.length,
          sensitivity: primaryItem.sensitivity,
          hasDrift
        });

        findings.push({
          id: `finding:dup:${key}`,
          title: `Duplicated configuration '${key}' across ${distinctFiles.length} files`,
          category: 'duplicated_configuration',
          categoryLabel: 'Duplicated Configuration',
          severity: riskBreakdown.severity,
          riskScore: riskBreakdown.total,
          riskBreakdown,
          configurationItem: primaryItem,
          confidence: 96,
          evidence,
          affectedFiles: distinctFiles,
          duplicateLocations,
          recommendation: `Consolidate duplicated declarations of '${key}' into an authoritative single source of truth. Ensure Docker/Compose, Kubernetes, and local .env files do not diverge silently.`,
          suggestedAction: `Consolidate ${distinctFiles.length} definitions into single configuration file.`
        });
      }
    }

    // Process individual items for other debt categories
    for (const item of items) {
      const usage = usageMap[item.key];
      const isUsed = usage ? usage.isUsed : false;
      const refCount = usage ? usage.referenceCount : 0;
      const confidence = usage ? usage.confidence : 0;

      // 2. HARDCODED SECRET DETECTION
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
          confidence: 94,
          evidence: [
            `Sensitive credential pattern matched: ${item.secretType || 'Credential literal'}.`,
            `Value is stored in plain text inside ${item.filePath}:${item.line}.`,
            `Zero-exposure mask applied for display.`
          ],
          affectedFiles: [item.filePath],
          secretDetectionType: item.secretType,
          recommendation: `Move '${item.key}' out of version-controlled files immediately. Store in an encrypted secrets vault or load dynamically via environment variables without hardcoding.`,
          suggestedAction: `Move plaintext secret to secret vault or masked .env file.`
        });
      }

      // 3. DEAD CONFIGURATION DETECTION
      if (!isUsed) {
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
          confidence: 95,
          evidence: [
            `No matching source-code references found across workspace files.`,
            `Defined at ${item.filePath}:${item.line} (${item.format.toUpperCase()}).`,
            item.ageDays !== undefined ? `Configuration item age: ${item.ageDays} days.` : 'No modification history.'
          ],
          affectedFiles: [item.filePath],
          recommendation: `Verify whether '${item.key}' belongs to a retired integration, abandoned experiment, or deprecated service. If no longer required, remove it to reduce configuration debt.`,
          suggestedAction: `Remove obsolete key '${item.key}' from ${item.filePath}.`
        });
      }

      // 4. OUTDATED / STALE CONFIGURATION DETECTION
      const isLegacyNamed = isLegacyKey(item.key);
      const isOld = (item.ageDays ?? 0) >= staleThreshold;

      if (isLegacyNamed || (isOld && !isUsed)) {
        // Only add if not already marked as dead with identical finding
        const alreadyDead = findings.some((f) => f.id === `finding:dead:${item.id}`);
        if (!alreadyDead || isLegacyNamed) {
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
            confidence: 88,
            evidence: [
              isLegacyNamed ? `Key name contains legacy/temporary indicator prefix.` : `Configuration has been unchanged for ${item.ageDays} days.`,
              `Referenced by ${refCount} source locations (detection confidence: ${confidence}%).`
            ],
            affectedFiles: [item.filePath],
            ageDays: item.ageDays,
            recommendation: `Audit '${item.key}' to confirm if the feature flag rollout or migration is complete. Remove temporary or deprecated configuration flags once migration finishes.`,
            suggestedAction: `Decommission stale feature flag or legacy configuration '${item.key}'.`
          });
        }
      }

      // 5. UNDOCUMENTED CONFIGURATION DETECTION
      // Only flag if configuration has no documentation and either is sensitive, has high age, or has multiple usages
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
          recommendation: `Add inline or header documentation specifying the purpose, valid values, defaults, and owner for '${item.key}'.`,
          suggestedAction: `Add documentation comments explaining '${item.key}'.`
        });
      }
    }

    // Sort findings by risk score descending (highest risk first)
    return findings.sort((a, b) => b.riskScore - a.riskScore);
  }
}

/**
 * Checks if key name indicates legacy, temporary, or deprecated settings
 */
function isLegacyKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    upper.startsWith('OLD_') ||
    upper.startsWith('LEGACY_') ||
    upper.startsWith('DEPRECATED_') ||
    upper.startsWith('TEMP_') ||
    upper.startsWith('TMP_') ||
    upper.startsWith('TEST_') ||
    upper.includes('_OLD') ||
    upper.includes('_LEGACY') ||
    upper.includes('_DEPRECATED')
  );
}
