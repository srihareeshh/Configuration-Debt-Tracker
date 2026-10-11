/**
 * Configuration Debt Tracker - Main Dashboard Webview Panel
 * Controls the primary dashboard tab in VS Code.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { AiExplainer } from '../ai/aiExplainer';
import { ScanResult } from '../models/scan';
import { CleanupService } from '../services/cleanupService';
import { HistoryService } from '../services/historyService';
import { ScanService } from '../services/scanService';
import { getDashboardHtml } from './dashboardHtml';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly scanService: ScanService;
  private readonly aiExplainer: AiExplainer;
  private currentResult: ScanResult | null = null;
  private isScanning = false;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    _extensionUri: vscode.Uri,
    scanService: ScanService,
    initialResult: ScanResult | null = null
  ) {
    this.panel = panel;
    this.scanService = scanService;
    this.aiExplainer = new AiExplainer();
    this.currentResult = initialResult;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );

    this.update();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    scanService: ScanService,
    initialResult: ScanResult | null = null
  ): DashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      if (initialResult) {
        DashboardPanel.currentPanel.setResult(initialResult);
      }
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'configDebtDashboard',
      'Configuration Debt Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      extensionUri,
      scanService,
      initialResult
    );
    return DashboardPanel.currentPanel;
  }

  public setResult(result: ScanResult): void {
    this.currentResult = result;
    this.update();
  }

  private async update(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : '';
    let history: any[] = [];
    if (workspaceRoot) {
      const historyService = new HistoryService(workspaceRoot);
      history = await historyService.getHistory();
    }

    this.panel.webview.html = getDashboardHtml(this.currentResult, history, this.isScanning);
  }

  private async handleMessage(message: {
    command: string;
    file?: string;
    line?: number;
    findingId?: string;
    status?: string;
    key?: string;
    prompt?: string;
  }): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : '';

    switch (message.command) {
      case 'scanWorkspace':
      case 'refresh':
        await this.runScan();
        break;

      case 'jumpTo':
        if (message.file && message.line) {
          await this.jumpToLocation(message.file, message.line);
        }
        break;

      case 'updateStatus':
        if (message.findingId && message.status && workspaceRoot) {
          const cleanupService = new CleanupService(workspaceRoot);
          await cleanupService.updateStatus(message.findingId, message.status as any);

          // Update in-memory item
          if (this.currentResult) {
            const item = this.currentResult.cleanupItems.find(
              (i) => i.findingId === message.findingId
            );
            if (item) {
              item.status = message.status as any;
            }
          }
          vscode.window.showInformationMessage(`Updated status to ${message.status}`);
        }
        break;

      case 'assessImpact':
        if (message.key && this.currentResult) {
          const impact = new (require('../core/impact/impactAnalyzer').ImpactAnalyzer)().assessRemovalImpact(message.key, this.currentResult);
          this.panel.webview.postMessage({
            command: 'impactResponse',
            impact
          });
        }
        break;

      case 'preparePatch':
        if (message.findingId && this.currentResult) {
          const finding = this.currentResult.findings.find((f) => f.id === message.findingId);
          if (finding) {
            const remediationService = new (require('../services/remediationService').RemediationService)(workspaceRoot);
            const proposal = remediationService.prepareProposal(finding);
            if (proposal) {
              const choice = await vscode.window.showInformationMessage(
                `Proposed Patch for ${finding.configurationItem.key}:\n${proposal.proposedDiff}`,
                'Apply Patch',
                'Cancel'
              );
              if (choice === 'Apply Patch') {
                const res = await remediationService.applyProposal(proposal);
                if (res.success) {
                  vscode.window.showInformationMessage(res.message);
                  await this.runScan();
                } else {
                  vscode.window.showErrorMessage(res.message);
                }
              }
            }
          }
        }
        break;

      case 'askLlm':
        if (message.prompt) {
          const config = vscode.workspace.getConfiguration('configDebt');
          let apiKey = '';
          try {
            apiKey = await (await import('../services/secretStorageService')).SecretStorageService.getInstance().getGeminiApiKey();
          } catch {
            apiKey = process.env.GEMINI_API_KEY || '';
          }

          let providerType = config.get<any>('aiProvider') || 'offline';
          if (providerType === 'offline' && apiKey) {
            providerType = 'gemini';
          }
          const model = config.get<string>('aiModel') || 'gemini-2.5-flash';
          const endpoint = config.get<string>('aiEndpoint') || '';

          const answer = await this.aiExplainer.chatWithAssistant(
            message.prompt,
            this.currentResult,
            { providerType, model, endpoint, geminiApiKey: apiKey }
          );

          this.panel.webview.postMessage({
            command: 'llmResponse',
            answer
          });
        }
        break;

      case 'explain':
        if (message.findingId && this.currentResult) {
          const finding = this.currentResult.findings.find((f) => f.id === message.findingId);
          if (finding) {
            const config = vscode.workspace.getConfiguration('configDebt');
            const apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;
            const explanation = await this.aiExplainer.explainFinding(finding, { geminiApiKey: apiKey });
            this.panel.webview.postMessage({
              command: 'aiExplanation',
              findingId: message.findingId,
              explanation
            });
          }
        }
        break;
    }
  }

  public async runScan(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('Configuration Debt Tracker: Open a workspace folder to scan.');
      return;
    }

    this.isScanning = true;
    const config = vscode.workspace.getConfiguration('configDebt');
    const excludes = config.get<string[]>('excludePatterns') || [];

    try {
      const result = await this.scanService.runScan(
        workspaceFolder.uri.fsPath,
        excludes,
        (stage, percent, detail) => {
          this.panel.webview.postMessage({
            command: 'scanProgress',
            stage,
            percent,
            detail
          });
        }
      );

      this.currentResult = result;
      this.isScanning = false;
      this.panel.webview.postMessage({ command: 'scanComplete' });
      await this.update();

      vscode.window.showInformationMessage(
        `Configuration Debt Scan Complete: Health ${result.healthScore.score}/100, ${result.findings.length} findings.`
      );
    } catch (err: unknown) {
      this.isScanning = false;
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Configuration Debt Scan Failed: ${msg}`);
      await this.update();
    }
  }

  public reveal(): void {
    this.panel.reveal();
  }

  private async jumpToLocation(relativeFilePath: string, line: number): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const fullPath = path.isAbsolute(relativeFilePath)
      ? relativeFilePath
      : path.join(workspaceFolder.uri.fsPath, relativeFilePath);

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
      const editor = await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: false
      });

      const zeroBasedLine = Math.max(0, line - 1);
      const lineRange = doc.lineAt(zeroBasedLine).range;

      editor.selection = new vscode.Selection(lineRange.start, lineRange.end);
      editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Cannot open ${relativeFilePath}: ${msg}`);
    }
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
