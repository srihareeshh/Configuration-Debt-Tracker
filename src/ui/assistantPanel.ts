/**
 * Configuration Debt Tracker - AI Assistant Webview Panel
 * Controls the dedicated interactive AI Assistant tab in VS Code.
 * Handles multi-turn conversations, clickable citation validation, and provider status.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { AiExplainer } from '../ai/aiExplainer';
import { ScanResult } from '../models/scan';
import { SecretStorageService } from '../services/secretStorageService';
import { AssistantRenderMessage, getAssistantHtml } from './assistantHtml';

export class AssistantPanel {
  public static currentPanel: AssistantPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly aiExplainer: AiExplainer;
  private currentResult: ScanResult | null = null;
  private disposables: vscode.Disposable[] = [];
  private renderMessages: AssistantRenderMessage[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    aiExplainer: AiExplainer,
    initialResult: ScanResult | null = null
  ) {
    this.panel = panel;
    this.aiExplainer = aiExplainer;
    this.currentResult = initialResult;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );

    this.updateHtml();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    aiExplainer: AiExplainer,
    initialResult: ScanResult | null = null
  ): AssistantPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.Beside;

    if (AssistantPanel.currentPanel) {
      AssistantPanel.currentPanel.panel.reveal(column);
      if (initialResult) {
        AssistantPanel.currentPanel.setResult(initialResult);
      }
      return AssistantPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'configDebtAssistant',
      'AI Assistant — Configuration Debt Tracker',
      column || vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
      }
    );

    AssistantPanel.currentPanel = new AssistantPanel(panel, aiExplainer, initialResult);
    return AssistantPanel.currentPanel;
  }

  public setResult(result: ScanResult): void {
    this.currentResult = result;
    this.aiExplainer.updateRepositoryIndex(result);
    this.updateHtml();
  }

  public async askQuestionFromExternal(query: string): Promise<void> {
    this.panel.reveal();
    await this.processQuestion(query);
  }

  private async updateHtml(): Promise<void> {
    const config = vscode.workspace.getConfiguration('configDebt');
    const secretService = SecretStorageService.getInstance();
    const hasKey = await secretService.hasGeminiApiKey();

    const providerType = config.get<string>('aiProvider') || (hasKey ? 'gemini' : 'offline');
    let providerStatus = 'Offline mode';

    if (providerType === 'gemini') {
      providerStatus = hasKey ? 'Gemini: Connected' : 'Gemini: Not configured';
    } else if (providerType === 'local') {
      providerStatus = 'Local model: Connected';
    }

    this.panel.webview.html = getAssistantHtml(
      this.renderMessages,
      providerStatus,
      false,
      Boolean(this.currentResult)
    );
  }

  private async handleMessage(message: {
    command: string;
    text?: string;
    file?: string;
    line?: number;
  }): Promise<void> {
    switch (message.command) {
      case 'askQuestion':
        if (message.text) {
          await this.processQuestion(message.text);
        }
        break;

      case 'jumpTo':
        if (message.file && message.line) {
          await this.jumpToCitation(message.file, message.line);
        }
        break;

      case 'clearHistory':
        this.aiExplainer.clearConversation();
        this.renderMessages = [];
        break;

      case 'testConnection':
        await vscode.commands.executeCommand('configDebt.testGeminiConnection');
        break;

      case 'setApiKey':
        await vscode.commands.executeCommand('configDebt.setGeminiApiKey');
        break;

      case 'scanWorkspace':
        await vscode.commands.executeCommand('configDebt.scanWorkspace');
        break;
    }
  }

  private async processQuestion(query: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('configDebt');
    let secretKey = '';
    try {
      secretKey = await SecretStorageService.getInstance().getGeminiApiKey();
    } catch {
      secretKey = process.env.GEMINI_API_KEY || '';
    }

    // Default to gemini if key is available, else offline
    let providerType = config.get<any>('aiProvider') || 'offline';
    if (providerType === 'offline' && secretKey) {
      providerType = 'gemini';
    }

    const model = config.get<string>('aiModel') || 'gemini-2.5-flash';
    const timeout = config.get<number>('aiTimeout') || 25000;
    const allowCloud = config.get<boolean>('aiAllowCloudContext') ?? true;

    this.renderMessages.push({
      role: 'user',
      content: query,
      timestamp: Date.now()
    });

    const settings = {
      providerType,
      model,
      geminiApiKey: secretKey,
      timeoutMs: timeout
    };

    const startTime = Date.now();
    try {
      const answer = await this.aiExplainer.chatWithAssistant(
        query,
        this.currentResult,
        settings,
        allowCloud
      );

      const latencyMs = Date.now() - startTime;
      const providerLabel = providerType === 'gemini' ? 'Google Gemini' : 'Offline Engine';

      this.renderMessages.push({
        role: 'assistant',
        content: answer,
        timestamp: Date.now(),
        provider: providerLabel,
        modelUsed: model,
        latencyMs
      });

      this.panel.webview.postMessage({
        command: 'assistantResponse',
        text: answer,
        provider: providerLabel,
        model,
        latencyMs
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.postMessage({
        command: 'assistantError',
        error: msg
      });
    }
  }

  private async jumpToCitation(relativeFilePath: string, line: number): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open.');
      return;
    }

    const workspaceRoot = path.resolve(workspaceFolder.uri.fsPath);
    const resolvedPath = path.isAbsolute(relativeFilePath)
      ? path.resolve(relativeFilePath)
      : path.resolve(workspaceRoot, relativeFilePath);

    // Security check: validate that path is strictly inside workspace
    const rel = path.relative(workspaceRoot, resolvedPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      vscode.window.showErrorMessage(`Security validation failed: '${relativeFilePath}' is outside workspace.`);
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(resolvedPath));
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
      vscode.window.showErrorMessage(`Cannot open file '${relativeFilePath}': ${msg}`);
    }
  }

  public dispose(): void {
    AssistantPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
