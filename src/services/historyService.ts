/**
 * Configuration Debt Tracker - Scan History Service (Module 7)
 * Persists lightweight historical scan snapshots to track debt trends over time.
 * Directly implements SCM Status Accounting.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ScanHistoryEntry, ScanResult } from '../models/scan';

export class HistoryService {
  private historyFilePath: string;

  constructor(workspaceRoot: string) {
    const configDebtDir = path.join(workspaceRoot, '.config-debt');
    this.historyFilePath = path.join(configDebtDir, 'history.json');
  }

  /**
   * Loads all historical scan entries sorted chronologically
   */
  async getHistory(): Promise<ScanHistoryEntry[]> {
    try {
      if (!fs.existsSync(this.historyFilePath)) {
        return [];
      }
      const raw = await fs.promises.readFile(this.historyFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Appends a new scan result to history and calculates delta from previous scan
   */
  async recordScan(scanResult: ScanResult): Promise<ScanHistoryEntry> {
    const history = await this.getHistory();
    const previous = history.length > 0 ? history[history.length - 1] : undefined;

    const deltaFromPrevious = previous !== undefined
      ? scanResult.healthScore.score - previous.healthScore
      : undefined;

    const entry: ScanHistoryEntry = {
      scanId: scanResult.scanId,
      timestamp: scanResult.timestamp,
      formattedDate: new Date(scanResult.timestamp).toLocaleString(),
      healthScore: scanResult.healthScore.score,
      totalItems: scanResult.inventory.totalItems,
      totalFindings: scanResult.findings.length,
      criticalCount: scanResult.inventory.bySeverity.critical,
      highCount: scanResult.inventory.bySeverity.high,
      mediumCount: scanResult.inventory.bySeverity.medium,
      lowCount: scanResult.inventory.bySeverity.low,
      deltaFromPrevious
    };

    history.push(entry);

    // Keep up to 50 latest history entries to keep it lightweight
    const trimmed = history.slice(-50);

    try {
      const dir = path.dirname(this.historyFilePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(this.historyFilePath, JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch {
      // Ignore write errors if workspace is read-only
    }

    return entry;
  }

  /**
   * Clears the scan history file
   */
  async clearHistory(): Promise<void> {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        await fs.promises.unlink(this.historyFilePath);
      }
    } catch {
      // Ignore
    }
  }
}
