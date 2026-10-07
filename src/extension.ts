/**
 * Configuration Debt Tracker - VS Code Extension Entrypoint
 * Registers SCM diagnostic views, commands, assistant interactions, and watcher.
 */

import * as vscode from 'vscode';
import { AiExplainer } from './ai/aiExplainer';
import { ImpactAnalyzer } from './core/impact/impactAnalyzer';
import { ScanResult } from './models/scan';
import { HistoryService } from './services/historyService';
import { ScanService } from './services/scanService';
import { DashboardPanel } from './ui/dashboardPanel';
import { SidebarProvider } from './ui/sidebarProvider';

let lastScanResult: ScanResult | null = null;
let watcherDisposable: vscode.Disposable | null = null;
let watchDebounceTimer: NodeJS.Timeout | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const scanService = new ScanService();
  const aiExplainer = new AiExplainer();
  const impactAnalyzer = new ImpactAnalyzer();
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
            aiExplainer.updateRepositoryIndex(result);

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

  // 4. Command: Show Findings
  const showFindingsCommand = vscode.commands.registerCommand(
    'configDebt.showFindings',
    async () => {
      if (!lastScanResult || lastScanResult.findings.length === 0) {
        vscode.window.showInformationMessage('No active configuration findings. Run a scan first.');
        return;
      }

      const items = lastScanResult.findings.map((f) => ({
        label: `[${f.severity.toUpperCase()}] ${f.title}`,
        description: `${f.configurationItem.filePath}:${f.configurationItem.line} (Risk: ${f.riskScore})`,
        detail: f.suggestedAction,
        finding: f
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a configuration finding to inspect'
      });

      if (selected) {
        const item = selected.finding.configurationItem;
        const fullPath = vscode.Uri.file(item.absoluteFilePath);
        const doc = await vscode.workspace.openTextDocument(fullPath);
        const editor = await vscode.window.showTextDocument(doc);
        const line = doc.lineAt(Math.max(0, item.line - 1));
        editor.selection = new vscode.Selection(line.range.start, line.range.end);
        editor.revealRange(line.range, vscode.TextEditorRevealType.InCenter);
      }
    }
  );
  context.subscriptions.push(showFindingsCommand);

  // 5. Command: Refresh Analysis
  const refreshCommand = vscode.commands.registerCommand(
    'configDebt.refreshAnalysis',
    async () => {
      await vscode.commands.executeCommand('configDebt.scanWorkspace');
    }
  );
  context.subscriptions.push(refreshCommand);

  // 6. Command: Clear History
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

  // 7. Command: Explain Finding
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
        const explanation = await aiExplainer.explainFinding(selection.finding, {
          providerType: config.get<any>('aiProvider') || 'offline',
          geminiApiKey: config.get<string>('geminiApiKey')
        });

        vscode.window.showInformationMessage(
          `[${explanation.provider}] ${explanation.summary}\n\n${explanation.remediationAdvice}`
        );
      }
    }
  );
  context.subscriptions.push(explainCommand);

  // 8. Command: Ask Repository Assistant
  const askAssistantCommand = vscode.commands.registerCommand(
    'configDebt.askAssistant',
    async () => {
      if (!lastScanResult) {
        vscode.window.showWarningMessage('Please run a workspace scan first to index configurations.');
        return;
      }

      const query = await vscode.window.showInputBox({
        prompt: 'Ask the repository assistant about configuration usage, drift, or risk',
        placeHolder: 'e.g. Where is DATABASE_URL used? Or: What breaks if I delete OLD_API_URL?'
      });

      if (query) {
        const config = vscode.workspace.getConfiguration('configDebt');
        const answer = await aiExplainer.chatWithAssistant(query, lastScanResult, {
          providerType: config.get<any>('aiProvider') || 'offline',
          geminiApiKey: config.get<string>('geminiApiKey'),
          model: config.get<string>('aiModel'),
          endpoint: config.get<string>('aiEndpoint')
        });

        const panel = vscode.window.createWebviewPanel(
          'configDebtAssistantResponse',
          `AI: ${query.slice(0, 30)}...`,
          vscode.ViewColumn.Beside,
          {}
        );
        panel.webview.html = `<html><body style="font-family:sans-serif; padding:16px; line-height:1.6; white-space:pre-wrap; background:var(--vscode-editor-background); color:var(--vscode-editor-foreground);"><h2>Query: ${query}</h2><hr/><p>${answer}</p></body></html>`;
      }
    }
  );
  context.subscriptions.push(askAssistantCommand);

  // 9. Command: Explain Selection
  const explainSelectionCommand = vscode.commands.registerCommand(
    'configDebt.explainSelection',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selectedText = editor.document.getText(editor.selection);
      if (!selectedText.trim()) {
        vscode.window.showInformationMessage('Please highlight a configuration access expression in your code.');
        return;
      }

      if (!lastScanResult) {
        vscode.window.showWarningMessage('Run a workspace scan first to index configuration settings.');
        return;
      }

      const prompt = `Explain highlighted code selection: "${selectedText.trim()}". What configuration is accessed, where is it declared, and does it carry configuration debt?`;
      const config = vscode.workspace.getConfiguration('configDebt');
      const answer = await aiExplainer.chatWithAssistant(prompt, lastScanResult, {
        providerType: config.get<any>('aiProvider') || 'offline',
        geminiApiKey: config.get<string>('geminiApiKey')
      });

      vscode.window.showInformationMessage(answer, 'OK');
    }
  );
  context.subscriptions.push(explainSelectionCommand);

  // 10. Command: Assess Removal Impact
  const assessImpactCommand = vscode.commands.registerCommand(
    'configDebt.assessImpact',
    async () => {
      if (!lastScanResult) {
        vscode.window.showWarningMessage('Run a workspace scan first to analyze configurations.');
        return;
      }

      const keys = Array.from(new Set(lastScanResult.items.map((i) => i.key)));
      const chosenKey = await vscode.window.showQuickPick(keys, {
        placeHolder: 'Select a configuration key to assess removal impact ("What breaks if I delete this?")'
      });

      if (chosenKey) {
        const impact = impactAnalyzer.assessRemovalImpact(chosenKey, lastScanResult);
        const panel = vscode.window.createWebviewPanel(
          'configDebtImpactView',
          `Impact: ${chosenKey}`,
          vscode.ViewColumn.Beside,
          {}
        );
        panel.webview.html = `<html><body style="font-family:sans-serif; padding:16px; line-height:1.5; background:var(--vscode-editor-background); color:var(--vscode-editor-foreground);">
          <h2>Removal Impact Assessment: <code>${impact.configurationKey}</code></h2>
          <p><strong>Impact Level:</strong> ${impact.impactLevel}</p>
          <p><strong>Static References:</strong> ${impact.staticReferenceCount} across ${impact.affectedFilesCount} file(s)</p>
          <hr/>
          <h3>Advisory</h3>
          <p>${impact.removalAdvisory}</p>
          <h3>Static Dependency Evidence</h3>
          <ul>${impact.staticDependencyEvidence.map((e) => `<li><code>${e.file}:${e.line}</code>: ${e.snippet}</li>`).join('')}</ul>
          <h3>Blind Spots</h3>
          <ul>${impact.blindSpots.map((b) => `<li>${b}</li>`).join('')}</ul>
        </body></html>`;
      }
    }
  );
  context.subscriptions.push(assessImpactCommand);

  // 11. Command: Test AI Connection
  const testAiCommand = vscode.commands.registerCommand(
    'configDebt.testAiConnection',
    async () => {
      const config = vscode.workspace.getConfiguration('configDebt');
      const settings = {
        providerType: config.get<any>('aiProvider') || 'offline',
        model: config.get<string>('aiModel'),
        endpoint: config.get<string>('aiEndpoint'),
        geminiApiKey: config.get<string>('geminiApiKey')
      };

      const testResult = await aiExplainer.testConnection(settings);
      if (testResult.ok) {
        vscode.window.showInformationMessage(`AI Status: ${testResult.message}`);
      } else {
        vscode.window.showWarningMessage(`AI Status: ${testResult.message}`);
      }
    }
  );
  context.subscriptions.push(testAiCommand);

  // 12. Command: Rebuild Code Index
  const rebuildIndexCommand = vscode.commands.registerCommand(
    'configDebt.rebuildIndex',
    async () => {
      await vscode.commands.executeCommand('configDebt.scanWorkspace');
    }
  );
  context.subscriptions.push(rebuildIndexCommand);

  // 13. Command: Watch Workspace
  const watchCommand = vscode.commands.registerCommand(
    'configDebt.watchWorkspace',
    () => {
      if (watcherDisposable) {
        watcherDisposable.dispose();
        watcherDisposable = null;
        vscode.window.showInformationMessage('Configuration Debt: Watch mode stopped.');
      } else {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        const triggerDebouncedScan = () => {
          if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
          watchDebounceTimer = setTimeout(() => {
            vscode.commands.executeCommand('configDebt.scanWorkspace');
          }, 1500);
        };

        watcher.onDidChange(triggerDebouncedScan);
        watcher.onDidCreate(triggerDebouncedScan);
        watcher.onDidDelete(triggerDebouncedScan);

        watcherDisposable = watcher;
        context.subscriptions.push(watcher);
        vscode.window.showInformationMessage('Configuration Debt: Watch mode active (auto-refreshing on file changes).');
      }
    }
  );
  context.subscriptions.push(watchCommand);
}

export function deactivate(): void {
  if (watcherDisposable) {
    watcherDisposable.dispose();
    watcherDisposable = null;
  }
}
