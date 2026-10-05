/**
 * Configuration Debt Tracker - VS Code Extension Entrypoint
 * Activates Activity Bar views, commands, and registers SCM audit pipelines.
 */

import * as vscode from 'vscode';
import { AiExplainer } from './ai/aiExplainer';
import { ScanResult } from './models/scan';
import { HistoryService } from './services/historyService';
import { ScanService } from './services/scanService';
import { DashboardPanel } from './ui/dashboardPanel';
import { SidebarProvider } from './ui/sidebarProvider';

let lastScanResult: ScanResult | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const scanService = new ScanService();
  const aiExplainer = new AiExplainer();
  const sidebarProvider = new SidebarProvider(context.extensionUri, scanService);

  // Register Activity Bar Sidebar View
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // 1. Command: Scan Workspace
  const scanCommand = vscode.commands.registerCommand(
    'configDebt.scanWorkspace',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('Please open a workspace folder to scan for configuration debt.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Configuration Debt Tracker',
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: 'Initiating workspace scan...' });

          const config = vscode.workspace.getConfiguration('configDebt');
          const excludes = config.get<string[]>('excludePatterns') || [];

          try {
            const result = await scanService.runScan(
              workspaceFolder.uri.fsPath,
              excludes,
              (stage, percent, detail) => {
                progress.report({
                  message: `${stage} (${percent}%) - ${detail || ''}`,
                  increment: percent
                });
              }
            );

            lastScanResult = result;
            sidebarProvider.updateResult(result);

            if (DashboardPanel.currentPanel) {
              DashboardPanel.currentPanel.setResult(result);
            }

            vscode.window.showInformationMessage(
              `Configuration Debt Scan Complete: Health ${result.healthScore.score}/100 (${result.healthScore.grade}), ${result.findings.length} findings.`
            );
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Scan failed: ${msg}`);
          }
        }
      );
    }
  );
  context.subscriptions.push(scanCommand);

  // 2. Command: Open Main Dashboard
  const dashboardCommand = vscode.commands.registerCommand(
    'configDebt.openDashboard',
    () => {
      DashboardPanel.createOrShow(context.extensionUri, scanService, lastScanResult);
    }
  );
  context.subscriptions.push(dashboardCommand);

  // 3. Command: Show Cleanup Backlog
  const backlogCommand = vscode.commands.registerCommand(
    'configDebt.showBacklog',
    () => {
      const panel = DashboardPanel.createOrShow(context.extensionUri, scanService, lastScanResult);
      panel.reveal();
    }
  );
  context.subscriptions.push(backlogCommand);

  // 4. Command: Refresh Analysis
  const refreshCommand = vscode.commands.registerCommand(
    'configDebt.refreshAnalysis',
    async () => {
      await vscode.commands.executeCommand('configDebt.scanWorkspace');
    }
  );
  context.subscriptions.push(refreshCommand);

  // 5. Command: Clear History
  const clearHistoryCommand = vscode.commands.registerCommand(
    'configDebt.clearHistory',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const historyService = new HistoryService(workspaceFolder.uri.fsPath);
        await historyService.clearHistory();
        vscode.window.showInformationMessage('Configuration Debt: Scan history cleared.');
        if (DashboardPanel.currentPanel && lastScanResult) {
          DashboardPanel.currentPanel.setResult(lastScanResult);
        }
      }
    }
  );
  context.subscriptions.push(clearHistoryCommand);

  // 6. Command: Explain Finding
  const explainCommand = vscode.commands.registerCommand(
    'configDebt.explainFinding',
    async () => {
      if (!lastScanResult || lastScanResult.findings.length === 0) {
        vscode.window.showInformationMessage('No active findings to explain. Run a scan first.');
        return;
      }

      const items = lastScanResult.findings.map((f) => ({
        label: `${f.severity.toUpperCase()}: ${f.title}`,
        description: `${f.configurationItem.filePath}:${f.configurationItem.line} (Risk: ${f.riskScore})`,
        finding: f
      }));

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a configuration debt finding to explain'
      });

      if (selection) {
        const config = vscode.workspace.getConfiguration('configDebt');
        const apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;
        const explanation = await aiExplainer.explainFinding(selection.finding, apiKey);

        vscode.window.showInformationMessage(
          `[${explanation.provider.toUpperCase()}] ${explanation.summary}`,
          'View Recommendation'
        ).then((action) => {
          if (action === 'View Recommendation') {
            vscode.window.showInformationMessage(explanation.remediationAdvice);
          }
        });
      }
    }
  );
  context.subscriptions.push(explainCommand);
}

export function deactivate(): void {
  // Cleanup if needed
}
