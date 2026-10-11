/**
 * Configuration Debt Tracker - VS Code Extension Entrypoint
 * Registers SCM diagnostic views, commands, assistant interactions, and watcher.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { AiExplainer } from './ai/aiExplainer';
import { ImpactAnalyzer } from './core/impact/impactAnalyzer';
import { ScanResult } from './models/scan';
import { HistoryService } from './services/historyService';
import { ScanService } from './services/scanService';
import { SecretStorageService } from './services/secretStorageService';
import { AssistantPanel } from './ui/assistantPanel';
import { DashboardPanel } from './ui/dashboardPanel';
import { SidebarProvider } from './ui/sidebarProvider';

let lastScanResult: ScanResult | null = null;
let watcherDisposable: vscode.Disposable | null = null;
let watchDebounceTimer: NodeJS.Timeout | null = null;

export function activate(context: vscode.ExtensionContext): void {
  // Initialize secure API key storage service
  const secretService = SecretStorageService.initialize(context.secrets);

  // Migrate legacy plaintext setting if user previously entered it in settings
  const config = vscode.workspace.getConfiguration('configDebt');
  const legacyKey = config.get<string>('geminiApiKey');
  if (legacyKey && legacyKey.trim()) {
    secretService.setGeminiApiKey(legacyKey.trim()).then(() => {
      config.update('geminiApiKey', undefined, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        'Configuration Debt: Migrated Gemini API key to encrypted SecretStorage.'
      );
    });
  }

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

          const currentConfig = vscode.workspace.getConfiguration('configDebt');
          const excludes = currentConfig.get<string[]>('excludePatterns') || [];

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
            if (AssistantPanel.currentPanel) {
              AssistantPanel.currentPanel.setResult(result);
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

  // 3. Command: Open AI Assistant
  const openAssistantCommand = vscode.commands.registerCommand(
    'configDebt.openAiAssistant',
    () => {
      AssistantPanel.createOrShow(context.extensionUri, aiExplainer, lastScanResult);
    }
  );
  context.subscriptions.push(openAssistantCommand);

  // Alias for backward compatibility: askAssistant -> openAiAssistant
  const askAssistantAlias = vscode.commands.registerCommand(
    'configDebt.askAssistant',
    () => {
      AssistantPanel.createOrShow(context.extensionUri, aiExplainer, lastScanResult);
    }
  );
  context.subscriptions.push(askAssistantAlias);

  // 4. Command: Set Gemini API Key
  const handleSetApiKey = async () => {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Google Gemini API key (stored encrypted in VS Code SecretStorage)',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'AIzaSy...'
    });

    if (!apiKey || !apiKey.trim()) {
      vscode.window.showWarningMessage('No API key entered. Operation cancelled.');
      return;
    }

    const trimmedKey = apiKey.trim();
    await secretService.setGeminiApiKey(trimmedKey);

    // Update active provider configuration immediately
    const currentConfig = vscode.workspace.getConfiguration('configDebt');
    const model = currentConfig.get<string>('aiModel') || 'gemini-2.5-flash';
    aiExplainer.getProviderFactory().getGeminiProvider().updateConfig(trimmedKey, model);
    aiExplainer.getProviderFactory().setGeminiStatus('Gemini: Connected');

    vscode.window.showInformationMessage(
      'Configuration Debt: Gemini API key stored securely in encrypted SecretStorage.'
    );

    // Offer to test connection immediately
    const testNow = await vscode.window.showInformationMessage(
      'Would you like to test the Gemini connection now?',
      'Test Connection',
      'Later'
    );
    if (testNow === 'Test Connection') {
      await vscode.commands.executeCommand('configurationDebt.testGeminiConnection');
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('configurationDebt.setGeminiApiKey', handleSetApiKey),
    vscode.commands.registerCommand('configDebt.setGeminiApiKey', handleSetApiKey)
  );

  // 5. Command: Remove Gemini API Key
  const handleRemoveApiKey = async () => {
    await secretService.removeGeminiApiKey();

    // Reset active provider configuration immediately
    const currentConfig = vscode.workspace.getConfiguration('configDebt');
    const model = currentConfig.get<string>('aiModel') || 'gemini-2.5-flash';
    aiExplainer.getProviderFactory().getGeminiProvider().updateConfig('', model);
    aiExplainer.getProviderFactory().setGeminiStatus('Gemini: Not configured');

    vscode.window.showInformationMessage(
      'Configuration Debt: Gemini API key removed from SecretStorage.'
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('configurationDebt.removeGeminiApiKey', handleRemoveApiKey),
    vscode.commands.registerCommand('configDebt.removeGeminiApiKey', handleRemoveApiKey)
  );

  // 6. Command: Test Gemini Connection
  const handleTestGemini = async () => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Configuration Debt: Testing Gemini connection...',
        cancellable: false
      },
      async () => {
        const secretKey = await secretService.getGeminiApiKey();
        const currentConfig = vscode.workspace.getConfiguration('configDebt');
        const model = currentConfig.get<string>('aiModel') || 'gemini-2.5-flash';
        const timeoutMs = currentConfig.get<number>('aiTimeout') || 25000;

        if (!secretKey && !process.env.GEMINI_API_KEY) {
          const setKeyChoice = await vscode.window.showWarningMessage(
            'Gemini API key is not configured. Please set your key first.',
            'Set Gemini API Key'
          );
          if (setKeyChoice === 'Set Gemini API Key') {
            await vscode.commands.executeCommand('configurationDebt.setGeminiApiKey');
          }
          return;
        }

        const result = await aiExplainer.testConnection({
          providerType: 'gemini',
          model,
          geminiApiKey: secretKey || process.env.GEMINI_API_KEY,
          timeoutMs
        });

        if (result.ok) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
      }
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('configurationDebt.testGeminiConnection', handleTestGemini),
    vscode.commands.registerCommand('configDebt.testGeminiConnection', handleTestGemini),
    vscode.commands.registerCommand('configDebt.testAiConnection', handleTestGemini)
  );

  // 7. Command: Explain Selection with AI
  const explainSelectionCommand = vscode.commands.registerCommand(
    'configDebt.explainSelection',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Open a source file to explain highlighted code.');
        return;
      }

      const selectedText = editor.document.getText(editor.selection);
      if (!selectedText.trim()) {
        vscode.window.showInformationMessage('Please highlight a code or configuration expression.');
        return;
      }

      const doc = editor.document;
      const relPath = vscode.workspace.asRelativePath(doc.uri);
      const lineNum = editor.selection.start.line + 1;

      const query = `Explain this highlighted selection from ${relPath}:${lineNum}:\n\`\`\`${doc.languageId}\n${selectedText.trim()}\n\`\`\`\nWhat configuration or architecture does it touch, and does it carry configuration debt?`;

      const panel = AssistantPanel.createOrShow(context.extensionUri, aiExplainer, lastScanResult);
      await panel.askQuestionFromExternal(query);
    }
  );
  context.subscriptions.push(explainSelectionCommand);

  // 8. Command: Ask About Current File
  const askCurrentFileCommand = vscode.commands.registerCommand(
    'configDebt.askAboutCurrentFile',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file open in editor.');
        return;
      }

      const doc = editor.document;
      const relPath = vscode.workspace.asRelativePath(doc.uri);
      const fileName = path.basename(relPath);

      const userQuestion = await vscode.window.showInputBox({
        prompt: `Ask a question about ${fileName}`,
        placeHolder: `e.g. Explain the role of ${fileName} in this project`
      });

      if (!userQuestion || !userQuestion.trim()) return;

      const query = `${userQuestion.trim()}\n\n[Focus File: ${relPath}]`;
      const panel = AssistantPanel.createOrShow(context.extensionUri, aiExplainer, lastScanResult);
      await panel.askQuestionFromExternal(query);
    }
  );
  context.subscriptions.push(askCurrentFileCommand);

  // 9. Command: Summarize Repository with AI
  const summarizeRepoCommand = vscode.commands.registerCommand(
    'configDebt.summarizeRepository',
    async () => {
      const panel = AssistantPanel.createOrShow(context.extensionUri, aiExplainer, lastScanResult);
      const query =
        'Summarize the entire repository for a developer who is new to it. Explain its core architecture, primary modules, and configuration posture.';
      await panel.askQuestionFromExternal(query);
    }
  );
  context.subscriptions.push(summarizeRepoCommand);

  // 10. Command: Show Cleanup Backlog
  const backlogCommand = vscode.commands.registerCommand(
    'configDebt.showBacklog',
    () => {
      const panel = DashboardPanel.createOrShow(context.extensionUri, scanService, lastScanResult);
      panel.reveal();
    }
  );
  context.subscriptions.push(backlogCommand);

  // 11. Command: Show Findings
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

  // 12. Command: Refresh Analysis
  const refreshCommand = vscode.commands.registerCommand(
    'configDebt.refreshAnalysis',
    async () => {
      await vscode.commands.executeCommand('configDebt.scanWorkspace');
    }
  );
  context.subscriptions.push(refreshCommand);

  // 13. Command: Clear History
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

  // 14. Command: Explain Finding
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
        const secretKey = await secretService.getGeminiApiKey();
        const currentConfig = vscode.workspace.getConfiguration('configDebt');
        const explanation = await aiExplainer.explainFinding(selection.finding, {
          providerType: currentConfig.get<any>('aiProvider') || (secretKey ? 'gemini' : 'offline'),
          geminiApiKey: secretKey || process.env.GEMINI_API_KEY
        });

        vscode.window.showInformationMessage(
          `[${explanation.provider}] ${explanation.summary}\n\n${explanation.remediationAdvice}`
        );
      }
    }
  );
  context.subscriptions.push(explainCommand);

  // 15. Command: Assess Removal Impact
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

  // 16. Command: Rebuild Code Index
  const rebuildIndexCommand = vscode.commands.registerCommand(
    'configDebt.rebuildIndex',
    async () => {
      await vscode.commands.executeCommand('configDebt.scanWorkspace');
    }
  );
  context.subscriptions.push(rebuildIndexCommand);

  // 17. Command: Watch Workspace
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
        vscode.window.showInformationMessage(
          'Configuration Debt: Watch mode active (auto-refreshing on file changes).'
        );
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
