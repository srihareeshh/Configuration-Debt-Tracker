/**
 * Configuration Debt Tracker - Cleanup Backlog Service (Module 6)
 * Prioritizes remediation actions and tracks status lifecycle: Open -> Needs Review -> Resolved / Ignored.
 * Directly implements SCM Configuration Control.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DebtFinding } from '../models/finding';
import { CleanupItem, CleanupStatus } from '../models/scan';

export class CleanupService {
  private backlogFilePath: string;

  constructor(workspaceRoot: string) {
    const configDebtDir = path.join(workspaceRoot, '.config-debt');
    this.backlogFilePath = path.join(configDebtDir, 'backlog.json');
  }

  /**
   * Loads saved user status decisions from disk
   */
  async loadSavedStatuses(): Promise<Record<string, { status: CleanupStatus; notes?: string; updatedAt: number }>> {
    try {
      if (!fs.existsSync(this.backlogFilePath)) {
        return {};
      }
      const raw = await fs.promises.readFile(this.backlogFilePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /**
   * Generates prioritized cleanup items from findings, preserving any existing user statuses
   */
  async generateCleanupBacklog(findings: DebtFinding[]): Promise<CleanupItem[]> {
    const saved = await this.loadSavedStatuses();

    // Findings are already sorted by risk score descending
    const items: CleanupItem[] = [];

    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      const savedInfo = saved[f.id];

      const item: CleanupItem = {
        id: `backlog:${f.id}`,
        findingId: f.id,
        priority: i + 1,
        riskScore: f.riskScore,
        severity: f.severity,
        category: f.categoryLabel,
        key: f.configurationItem.key,
        file: f.configurationItem.filePath,
        line: f.configurationItem.line,
        evidence: f.evidence.join(' '),
        suggestedAction: f.suggestedAction,
        status: savedInfo?.status || 'open',
        statusNotes: savedInfo?.notes,
        updatedAt: savedInfo?.updatedAt || Date.now()
      };

      items.push(item);
    }

    return items;
  }

  /**
   * Updates an item's status and persists it to disk
   */
  async updateStatus(
    findingId: string,
    newStatus: CleanupStatus,
    notes?: string
  ): Promise<void> {
    const saved = await this.loadSavedStatuses();
    saved[findingId] = {
      status: newStatus,
      notes,
      updatedAt: Date.now()
    };

    try {
      const dir = path.dirname(this.backlogFilePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(this.backlogFilePath, JSON.stringify(saved, null, 2), 'utf-8');
    } catch {
      // Ignore
    }
  }
}
