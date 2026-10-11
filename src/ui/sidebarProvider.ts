/**
 * Configuration Debt Tracker - Sidebar Webview Provider
 * Pixel-perfect diagnostic sidebar with zero fake defaults and integrated repository assistant.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { AiExplainer } from '../ai/aiExplainer';
import { ImpactAnalyzer } from '../core/impact/impactAnalyzer';
import { ScanResult } from '../models/scan';
import { HistoryService } from '../services/historyService';
import { RemediationService } from '../services/remediationService';
import { ScanService } from '../services/scanService';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'configDebt.sidebarView';
  private view?: vscode.WebviewView;
  private currentResult: ScanResult | null = null;
  private aiExplainer: AiExplainer;
  private impactAnalyzer = new ImpactAnalyzer();

  constructor(
    private readonly extensionUri: vscode.Uri,
    _scanService: ScanService
  ) {
    this.aiExplainer = new AiExplainer();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    this.updateViewHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'scan':
          await vscode.commands.executeCommand('configDebt.scanWorkspace');
          break;

        case 'openDashboard':
          await vscode.commands.executeCommand('configDebt.openDashboard');
          break;

        case 'jumpTo':
          if (message.file && message.line) {
            await this.jumpToLocation(message.file, message.line);
          }
          break;

        case 'assessImpact':
          if (message.key && this.currentResult) {
            const impact = this.impactAnalyzer.assessRemovalImpact(message.key, this.currentResult);
            this.view?.webview.postMessage({
              command: 'impactResponse',
              impact
            });
          }
          break;

        case 'preparePatch':
          if (message.findingId && this.currentResult) {
            const finding = this.currentResult.findings.find((f) => f.id === message.findingId);
            if (finding) {
              const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
              const remediationService = new RemediationService(workspaceFolder?.uri.fsPath || '');
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
                    await vscode.commands.executeCommand('configDebt.scanWorkspace');
                  } else {
                    vscode.window.showErrorMessage(res.message);
                  }
                }
              }
            }
          }
          break;

        case 'openAssistant':
          await vscode.commands.executeCommand('configDebt.openAiAssistant');
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
              {
                providerType,
                model,
                endpoint,
                geminiApiKey: apiKey
              }
            );

            this.view?.webview.postMessage({
              command: 'llmResponse',
              answer
            });
          }
          break;
      }
    });
  }

  public async updateResult(result: ScanResult): Promise<void> {
    this.currentResult = result;
    this.aiExplainer.updateRepositoryIndex(result);
    await this.updateViewHtml();
  }

  private async updateViewHtml(): Promise<void> {
    if (!this.view) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : '';
    let history: any[] = [];
    if (workspaceRoot) {
      const historyService = new HistoryService(workspaceRoot);
      history = await historyService.getHistory();
    }
    this.view.webview.html = this.getHtmlContent(history);
  }

  private async jumpToLocation(relativeFilePath: string, line: number): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const fullPath = path.isAbsolute(relativeFilePath)
      ? relativeFilePath
      : path.join(workspaceFolder.uri.fsPath, relativeFilePath);

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
      const editor = await vscode.window.showTextDocument(doc, { preview: true });
      const zeroBased = Math.max(0, line - 1);
      const lineRange = doc.lineAt(zeroBased).range;
      editor.selection = new vscode.Selection(lineRange.start, lineRange.end);
      editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
    } catch {
      // Ignore navigation errors
    }
  }

  private getHtmlContent(history: any[]): string {
    const res = this.currentResult;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configuration Debt</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background, #1e1e1e);
      --fg: var(--vscode-sideBar-foreground, #cccccc);
      --border: var(--vscode-widget-border, #333333);
      --card-bg: var(--vscode-editor-background, #252526);
      --accent: var(--vscode-button-background, #0e639c);
      --accent-hover: var(--vscode-button-hoverBackground, #1177bb);
      --accent-fg: var(--vscode-button-foreground, #ffffff);
      --subtle: var(--vscode-descriptionForeground, #858585);

      --crit: #f14c4c;
      --high: #e88500;
      --med: #cca700;
      --low: #3794ff;

      --font-mono: var(--vscode-editor-font-family, Menlo, Monaco, 'Courier New', monospace);
      --font-sans: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: var(--vscode-font-size, 12px);
      line-height: 1.4;
      padding: 10px 12px;
      user-select: none;
    }

    .divider {
      height: 1px;
      background: var(--border);
      margin: 12px 0;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .sidebar-header h2 {
      font-size: 13px;
      font-weight: 600;
      color: var(--fg);
      letter-spacing: -0.1px;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }

    .icon-btn {
      background: none;
      border: 1px solid var(--border);
      color: var(--fg);
      cursor: pointer;
      padding: 3px 7px;
      font-size: 11px;
      border-radius: 2px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .icon-btn:hover {
      background: var(--card-bg);
      border-color: var(--subtle);
    }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--subtle);
      margin-bottom: 6px;
    }

    /* Empty state */
    .empty-state-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 16px 12px;
      text-align: center;
    }

    .empty-state-box h3 {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--fg);
    }

    .empty-state-box p {
      font-size: 11px;
      color: var(--subtle);
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .btn-primary {
      background: var(--accent);
      color: var(--accent-fg);
      border: none;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 500;
      border-radius: 2px;
      cursor: pointer;
      width: 100%;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    /* Health */
    .health-container {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .health-score {
      font-family: var(--font-mono);
      font-size: 26px;
      font-weight: 700;
      line-height: 1;
    }

    .health-score .denom {
      font-size: 13px;
      color: var(--subtle);
      font-weight: 400;
    }

    .health-delta {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: #3fb950;
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .health-delta.negative {
      color: var(--crit);
    }

    .severity-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      font-size: 10px;
      text-align: center;
      margin-bottom: 4px;
    }

    .sev-item {
      padding: 4px 2px;
      border-radius: 2px;
      background: var(--card-bg);
      border: 1px solid var(--border);
    }

    .sev-item.critical { border-left: 2px solid var(--crit); }
    .sev-item.high { border-left: 2px solid var(--high); }
    .sev-item.medium { border-left: 2px solid var(--med); }
    .sev-item.low { border-left: 2px solid var(--low); }

    /* Inventory */
    .inventory-stats {
      display: flex;
      justify-content: space-between;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 8px 10px;
      font-size: 11px;
      font-family: var(--font-mono);
    }

    /* Priority Cleanup Cards */
    .cleanup-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cleanup-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 8px 10px;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }

    .cleanup-card:hover {
      border-color: var(--subtle);
    }

    .cleanup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-key {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 11px;
      color: var(--fg);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 140px;
    }

    .card-loc {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--subtle);
    }

    .card-desc {
      font-size: 11px;
      color: var(--subtle);
      margin-top: 3px;
      line-height: 1.3;
    }

    .card-actions {
      display: flex;
      gap: 4px;
      margin-top: 6px;
    }

    .card-btn {
      background: none;
      border: 1px solid var(--border);
      color: var(--subtle);
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 2px;
      cursor: pointer;
    }

    .card-btn:hover {
      color: var(--fg);
      border-color: var(--fg);
    }

    /* Trend */
    .trend-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 8px 10px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--subtle);
      text-align: center;
    }

    /* AI Assistant */
    .llm-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 10px;
    }

    .llm-input-row {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }

    .llm-input {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      font-size: 11px;
      padding: 5px 8px;
      border-radius: 2px;
      outline: none;
    }

    .llm-input:focus {
      border-color: var(--accent);
    }

    .llm-submit {
      background: var(--accent);
      color: var(--accent-fg);
      border: none;
      padding: 5px 10px;
      font-size: 11px;
      border-radius: 2px;
      cursor: pointer;
    }

    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }

    .chip {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--subtle);
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 2px;
      cursor: pointer;
    }

    .chip:hover {
      color: var(--fg);
      border-color: var(--subtle);
    }

    .llm-response {
      display: none;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.5;
      color: var(--fg);
      white-space: pre-wrap;
      max-height: 180px;
      overflow-y: auto;
    }

    .llm-response.active {
      display: block;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="sidebar-header">
    <h2>Configuration Debt</h2>
    <div class="header-actions">
      <button class="icon-btn" onclick="postMsg('scan')">Scan</button>
      <button class="icon-btn" onclick="postMsg('openDashboard')">Dashboard</button>
    </div>
  </div>

  <div class="divider"></div>

  ${!res ? `
    <!-- Genuine Empty State: Zero Fake Defaults -->
    <div class="empty-state-box">
      <h3>No scan available</h3>
      <p>Run a workspace scan to analyze configuration items, track debt, and assess risk.</p>
      <button class="btn-primary" onclick="postMsg('scan')">Scan Workspace</button>
    </div>
  ` : `
    <!-- HEALTH -->
    <div class="section-label">HEALTH</div>
    <div class="health-container">
      <div class="health-score">
        ${res.healthScore.score} <span class="denom">/ 100</span>
      </div>
      <div class="health-delta">
        ${res.healthScore.grade}
      </div>
    </div>

    <div class="severity-row">
      <div class="sev-item critical"><strong>${res.inventory.bySeverity.critical}</strong> Crit</div>
      <div class="sev-item high"><strong>${res.inventory.bySeverity.high}</strong> High</div>
      <div class="sev-item medium"><strong>${res.inventory.bySeverity.medium}</strong> Med</div>
      <div class="sev-item low"><strong>${res.inventory.bySeverity.low}</strong> Low</div>
    </div>

    <div class="divider"></div>

    <!-- CONFIGURATION INVENTORY -->
    <div class="section-label">CONFIGURATION INVENTORY</div>
    <div class="inventory-stats">
      <span><strong>${res.inventory.totalItems}</strong> total</span>
      <span style="color:#3fb950;"><strong>${res.inventory.usedItems}</strong> used</span>
      <span style="color:var(--crit);"><strong>${res.inventory.unusedItems}</strong> unused</span>
    </div>

    <div class="divider"></div>

    <!-- PRIORITY CLEANUP -->
    <div class="section-label">PRIORITY CLEANUP</div>
    <div class="cleanup-list">
      ${res.findings.slice(0, 3).map((f) => `
        <div class="cleanup-card">
          <div class="cleanup-header" onclick="jumpTo('${f.configurationItem.filePath}', ${f.configurationItem.line})">
            <span class="card-key">${f.configurationItem.key}</span>
            <span class="card-loc">${f.configurationItem.filePath}:${f.configurationItem.line}</span>
          </div>
          <div class="card-desc">${f.categoryLabel} &bull; Risk: ${f.riskScore} (${f.severity})</div>
          <div class="card-actions">
            <button class="card-btn" onclick="assessImpact('${f.configurationItem.key}')">Impact</button>
            <button class="card-btn" onclick="preparePatch('${f.id}')">Fix</button>
            <button class="card-btn" onclick="askAboutFinding('${f.configurationItem.key}')">Ask AI</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="divider"></div>

    <!-- HEALTH TREND -->
    <div class="section-label">HEALTH TREND</div>
    <div class="trend-box">
      ${history.length > 1
        ? history.slice(-4).map((h) => `${h.healthScore}`).join(' ─────── ')
        : `${res.healthScore.score} / 100 (${res.healthScore.grade})`}
    </div>
  `}

  <div class="divider"></div>

  <!-- AI ASSISTANT -->
  <div class="section-label">AI ASSISTANT</div>
  <div class="llm-box">
    <div class="chips-row">
      <span class="chip" onclick="askQuick('Where is DATABASE_URL used?')">DATABASE_URL</span>
      <span class="chip" onclick="askQuick('Explain configuration drift')">Drift</span>
      <span class="chip" onclick="askQuick('Which configuration has highest risk?')">Highest Risk</span>
    </div>

    <div class="llm-input-row">
      <input type="text" id="llmInput" class="llm-input" placeholder="Ask about repository configuration..." onkeydown="handleKey(event)" />
      <button class="llm-submit" onclick="submitLlm()">Ask</button>
    </div>

    <div id="llmResponse" class="llm-response"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function postMsg(cmd) {
      vscode.postMessage({ command: cmd });
    }

    function jumpTo(file, line) {
      vscode.postMessage({ command: 'jumpTo', file, line });
    }

    function assessImpact(key) {
      vscode.postMessage({ command: 'assessImpact', key });
    }

    function preparePatch(findingId) {
      vscode.postMessage({ command: 'preparePatch', findingId });
    }

    function askAboutFinding(key) {
      const input = document.getElementById('llmInput');
      input.value = "Why is " + key + " flagged and what breaks if I delete it?";
      submitLlm();
    }

    function askQuick(text) {
      const input = document.getElementById('llmInput');
      input.value = text;
      submitLlm();
    }

    function handleKey(e) {
      if (e.key === 'Enter') submitLlm();
    }

    function submitLlm() {
      const input = document.getElementById('llmInput');
      const text = input.value.trim();
      if (!text) return;

      const respBox = document.getElementById('llmResponse');
      respBox.classList.add('active');
      respBox.textContent = "Analyzing repository index and retrieving evidence...";

      vscode.postMessage({ command: 'askLlm', prompt: text });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'llmResponse') {
        const respBox = document.getElementById('llmResponse');
        respBox.classList.add('active');
        respBox.textContent = msg.answer;
      } else if (msg.command === 'impactResponse') {
        const respBox = document.getElementById('llmResponse');
        respBox.classList.add('active');
        const imp = msg.impact;
        respBox.textContent = "REMOVAL IMPACT: " + imp.configurationKey + "\\n" +
          "Impact Level: " + imp.impactLevel + "\\n" +
          "References: " + imp.staticReferenceCount + " across " + imp.affectedFilesCount + " file(s)\\n" +
          "Advisory: " + imp.removalAdvisory;
      }
    });
  </script>
</body>
</html>`;
  }
}
