/**
 * Configuration Debt Tracker - Scan Service (Master Pipeline Orchestrator)
 * Coordinates the entire SCM analysis pipeline:
 * Workspace -> Scanner -> Inventory -> Usage Analyzer -> Detector -> Risk -> Health -> Backlog -> History
 */

import * as path from 'path';
import { SourceUsageAnalyzer } from '../core/analyzer/sourceUsageAnalyzer';
import { DebtDetector } from '../core/detector/debtDetector';
import { HealthScoreCalculator } from '../core/health/healthScoreCalculator';
import { RiskEngine } from '../core/risk/riskEngine';
import { ConfigurationScanner } from '../core/scanner/configurationScanner';
import { ScanResult } from '../models/scan';
import { CleanupService } from './cleanupService';
import { HistoryService } from './historyService';

export interface ScanPipelineProgressCallback {
  (stage: string, percent: number, detail?: string): void;
}

export class ScanService {
  private scanner: ConfigurationScanner;
  private usageAnalyzer: SourceUsageAnalyzer;
  private detector: DebtDetector;
  private healthCalculator: HealthScoreCalculator;
  private riskEngine: RiskEngine;

  constructor() {
    this.riskEngine = new RiskEngine();
    this.scanner = new ConfigurationScanner();
    this.usageAnalyzer = new SourceUsageAnalyzer();
    this.detector = new DebtDetector(this.riskEngine);
    this.healthCalculator = new HealthScoreCalculator();
  }

  /**
   * Executes the full Configuration Debt Analysis Pipeline
   */
  async runScan(
    workspaceRoot: string,
    excludePatterns: string[] = [],
    onProgress?: ScanPipelineProgressCallback
  ): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = `scan-${startTime}`;
    const workspaceName = path.basename(workspaceRoot);

    // Stage 1: Discover and scan configuration files
    if (onProgress) {
      onProgress('Scanning configuration files', 15, 'Walking workspace directory...');
    }
    const scanRes = await this.scanner.scanWorkspace(
      workspaceRoot,
      excludePatterns,
      (curr, total, file) => {
        if (onProgress) {
          const pct = 15 + Math.round((curr / Math.max(1, total)) * 25); // 15% -> 40%
          onProgress('Scanning configuration files', pct, `${file} (${curr}/${total})`);
        }
      }
    );

    // Stage 2: Analyze source code references
    if (onProgress) {
      onProgress('Analyzing source usage', 40, 'Indexing source code references...');
    }
    const usageMap = await this.usageAnalyzer.analyzeUsage(
      scanRes.items,
      scanRes.allScannedFiles,
      (curr, total, key) => {
        if (onProgress) {
          const pct = 40 + Math.round((curr / Math.max(1, total)) * 30); // 40% -> 70%
          onProgress('Analyzing source usage', pct, `Checking '${key}' (${curr}/${total})`);
        }
      }
    );

    // Stage 3: Detect Configuration Debt
    if (onProgress) {
      onProgress('Detecting configuration debt', 75, 'Evaluating debt categories and risk factors...');
    }
    const findings = this.detector.detectDebt(scanRes.items, usageMap);

    // Stage 4: Calculate Configuration Health Score
    if (onProgress) {
      onProgress('Calculating health score', 85, 'Computing status accounting metrics...');
    }
    const { healthScore, inventory } = this.healthCalculator.calculateHealthScore(
      scanRes.items,
      findings,
      usageMap
    );

    // Stage 5: Build Cleanup Backlog
    if (onProgress) {
      onProgress('Prioritizing cleanup backlog', 92, 'Organizing configuration control items...');
    }
    const cleanupService = new CleanupService(workspaceRoot);
    const cleanupItems = await cleanupService.generateCleanupBacklog(findings);

    const scanDurationMs = Date.now() - startTime;

    const result: ScanResult = {
      scanId,
      workspaceName,
      workspacePath: workspaceRoot,
      timestamp: startTime,
      healthScore,
      inventory,
      findings,
      items: scanRes.items,
      usageMap,
      cleanupItems,
      scanDurationMs,
      errors: scanRes.errors
    };

    // Stage 6: Record history
    if (onProgress) {
      onProgress('Finalizing scan', 98, 'Recording scan history snapshot...');
    }
    const historyService = new HistoryService(workspaceRoot);
    await historyService.recordScan(result);

    if (onProgress) {
      onProgress('Scan complete', 100, `Analyzed ${scanRes.items.length} items, found ${findings.length} debt items.`);
    }

    return result;
  }
}
