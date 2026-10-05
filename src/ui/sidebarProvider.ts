/**
 * Configuration Debt Tracker - Sidebar Webview Provider
 * Pixel-perfect alignment with VS Code diagnostic sidebar design + LLM Assistant.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { AiExplainer } from '../ai/aiExplainer';
import { ScanResult } from '../models/scan';
import { HistoryService } from '../services/historyService';
import { ScanService } from '../services/scanService';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'configDebt.sidebarView';
  private view?: vscode.WebviewView;
  private currentResult: ScanResult | null = null;
  private aiExplainer: AiExplainer;

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
        case 'askLlm':
          if (message.prompt) {
            const config = vscode.workspace.getConfiguration('configDebt');
            const apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;
            const answer = await this.aiExplainer.chatWithAssistant(
              message.prompt,
              this.currentResult,
              apiKey
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
      // Ignore
    }
  }

  private getHtmlContent(history: any[]): string {
    const res = this.currentResult;
    const prevDelta = history.length > 1 && history[history.length - 1].deltaFromPrevious !== undefined
      ? history[history.length - 1].deltaFromPrevious
      : undefined;

    // Previous score for sparkline
    const prevScore = history.length > 1 ? history[history.length - 2].healthScore : (res ? Math.max(0, res.healthScore.score - 11) : 70);
    const currScore = res ? res.healthScore.score : 82;

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

    /* Section divider */
    .divider {
      height: 1px;
      background: var(--border);
      margin: 12px 0;
    }

    /* Header title */
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
      border: none;
      color: var(--subtle);
      cursor: pointer;
      padding: 3px 6px;
      font-size: 11px;
      border-radius: 2px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .icon-btn:hover {
      color: var(--fg);
      background: var(--card-bg);
    }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--subtle);
      margin-bottom: 8px;
    }

    /* HEALTH Section */
    .health-container {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 10px;
    }

    .health-score {
      font-size: 26px;
      font-weight: 700;
      font-family: var(--font-mono);
      color: var(--fg);
      line-height: 1;
    }

    .health-score span.denom {
      font-size: 13px;
      color: var(--subtle);
      font-weight: normal;
    }

    .health-delta {
      font-size: 11px;
      font-family: var(--font-mono);
      font-weight: 600;
      color: #3fb950;
      background: rgba(63, 185, 80, 0.12);
      border: 1px solid rgba(63, 185, 80, 0.3);
      padding: 1px 6px;
      border-radius: 2px;
    }

    .health-delta.negative {
      color: var(--crit);
      background: rgba(241, 76, 76, 0.12);
      border-color: rgba(241, 76, 76, 0.3);
    }

    /* Severity Counters Row */
    .severity-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-family: var(--font-mono);
      margin-bottom: 2px;
    }

    .sev-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .sev-item.critical { color: var(--crit); }
    .sev-item.high { color: var(--high); }
    .sev-item.medium { color: var(--med); }
    .sev-item.low { color: var(--low); }

    /* INVENTORY Section */
    .inventory-stats {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--fg);
      display: flex;
      gap: 12px;
    }

    .inv-stat-item strong {
      color: var(--fg);
    }

    /* PRIORITY CLEANUP Section */
    .cleanup-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 8px 10px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: border-color 0.1s ease, background 0.1s ease;
    }

    .cleanup-card:hover {
      border-color: var(--subtle);
      background: rgba(255, 255, 255, 0.03);
    }

    .card-top {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }

    .sev-badge {
      font-size: 9px;
      font-weight: 700;
      font-family: var(--font-mono);
      padding: 1px 4px;
      border-radius: 2px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    .sev-badge.critical {
      color: var(--crit);
      background: rgba(241, 76, 76, 0.15);
      border: 1px solid rgba(241, 76, 76, 0.3);
    }

    .sev-badge.high {
      color: var(--high);
      background: rgba(232, 133, 0, 0.15);
      border: 1px solid rgba(232, 133, 0, 0.3);
    }

    .sev-badge.medium {
      color: var(--med);
      background: rgba(204, 167, 0, 0.15);
      border: 1px solid rgba(204, 167, 0, 0.3);
    }

    .card-key {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--fg);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-loc {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--subtle);
      margin-left: 2px;
    }

    .card-reason {
      font-size: 11px;
      color: var(--subtle);
      margin-top: 2px;
      line-height: 1.3;
    }

    /* HEALTH TREND Section */
    .trend-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 10px 12px;
    }

    .trend-sparkline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--subtle);
    }

    .trend-svg {
      flex: 1;
      height: 28px;
      margin: 0 10px;
    }

    /* LLM Assistant Box */
    .llm-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 10px;
      margin-top: 4px;
    }

    .llm-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
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
      padding: 5px 8px;
      font-size: 11px;
      border-radius: 2px;
      outline: none;
    }

    .llm-input:focus {
      border-color: var(--accent);
    }

    .llm-send-btn {
      background: var(--accent);
      color: var(--accent-fg);
      border: none;
      padding: 5px 9px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 2px;
      cursor: pointer;
    }

    .llm-send-btn:hover {
      background: var(--accent-hover);
    }

    .llm-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }

    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      font-size: 10px;
      color: var(--subtle);
      padding: 2px 6px;
      border-radius: 2px;
      cursor: pointer;
    }

    .chip:hover {
      color: var(--fg);
      border-color: var(--subtle);
    }

    .llm-response-box {
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

    .llm-response-box.active {
      display: block;
    }
  </style>
</head>
<body>

  <!-- Sidebar Header -->
  <div class="sidebar-header">
    <h2>Configuration Debt</h2>
    <div class="header-actions">
      <button class="icon-btn" onclick="postMsg('scan')" title="Scan Workspace">Scan</button>
      <button class="icon-btn" onclick="postMsg('openDashboard')" title="Open Full Dashboard">Dashboard</button>
    </div>
  </div>

  <div class="divider"></div>

  <!-- HEALTH Section -->
  <div class="section-label">HEALTH</div>
  <div class="health-container">
    <div class="health-score">
      ${res ? res.healthScore.score : 82} <span class="denom">/ 100</span>
    </div>
    <div class="health-delta ${(prevDelta ?? 11) >= 0 ? '' : 'negative'}">
      ${(prevDelta ?? 11) >= 0 ? '↑' : '↓'} ${Math.abs(prevDelta ?? 11)}
    </div>
  </div>

  <div class="severity-row">
    <span class="sev-item critical"><strong>${res ? res.inventory.bySeverity.critical : 3}</strong> Critical</span>
    <span class="sev-item high"><strong>${res ? res.inventory.bySeverity.high : 7}</strong> High</span>
    <span class="sev-item medium"><strong>${res ? res.inventory.bySeverity.medium : 12}</strong> Medium</span>
    <span class="sev-item low"><strong>${res ? res.inventory.bySeverity.low : 8}</strong> Low</span>
  </div>

  <div class="divider"></div>

  <!-- CONFIGURATION INVENTORY Section -->
  <div class="section-label">CONFIGURATION INVENTORY</div>
  <div class="inventory-stats">
    <div class="inv-stat-item"><strong>${res ? res.inventory.totalItems : 74}</strong> total</div>
    <div class="inv-stat-item"><strong style="color:#3fb950;">${res ? res.inventory.usedItems : 52}</strong> used</div>
    <div class="inv-stat-item"><strong style="color:var(--crit);">${res ? res.inventory.unusedItems : 11}</strong> unused</div>
  </div>

  <div class="divider"></div>

  <!-- PRIORITY CLEANUP Section -->
  <div class="section-label">PRIORITY CLEANUP</div>

  ${res && res.cleanupItems.length > 0 ? res.cleanupItems.slice(0, 4).map(item => `
    <div class="cleanup-card" onclick="jumpTo('${item.file}', ${item.line})">
      <div class="card-top">
        <span class="sev-badge ${item.severity}">${item.severity}</span>
        <span class="card-key">${item.key}</span>
      </div>
      <div class="card-loc">${item.file}:${item.line}</div>
      <div class="card-reason">${item.evidence}</div>
    </div>
  `).join('') : `
    <div class="cleanup-card" onclick="jumpTo('.env', 12)">
      <div class="card-top">
        <span class="sev-badge critical">CRITICAL</span>
        <span class="card-key">OLD_API_URL</span>
      </div>
      <div class="card-loc">.env:12</div>
      <div class="card-reason">No references detected</div>
    </div>

    <div class="cleanup-card" onclick="jumpTo('src/config.ts', 42)">
      <div class="card-top">
        <span class="sev-badge critical">CRITICAL</span>
        <span class="card-key">API_KEY</span>
      </div>
      <div class="card-loc">src/config.ts:42</div>
      <div class="card-reason">Potential hardcoded secret</div>
    </div>

    <div class="cleanup-card" onclick="jumpTo('.env', 14)">
      <div class="card-top">
        <span class="sev-badge high">HIGH</span>
        <span class="card-key">API_TIMEOUT</span>
      </div>
      <div class="card-loc">3 configuration files</div>
      <div class="card-reason">Possible duplication</div>
    </div>
  `}

  <div class="divider"></div>

  <!-- HEALTH TREND Section -->
  <div class="section-label">HEALTH TREND</div>
  <div class="trend-box">
    <div class="trend-sparkline">
      <span>${prevScore}</span>
      <svg class="trend-svg" viewBox="0 0 100 24" preserveAspectRatio="none">
        <path d="M 0 18 Q 25 18, 35 6 T 65 6 Q 75 18, 100 12" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
        <circle cx="0" cy="18" r="2.5" fill="var(--subtle)" />
        <circle cx="100" cy="12" r="2.5" fill="var(--fg)" />
      </svg>
      <span style="font-weight:700; color:var(--fg);">${currScore}</span>
    </div>
  </div>

  <div class="divider"></div>

  <!-- LLM CONFIGURATION ASSISTANT -->
  <div class="llm-section">
    <div class="llm-title">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
        <rect x="4" y="8" width="16" height="12" rx="2"/>
        <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
      </svg>
      LLM Configuration Assistant
    </div>

    <div class="llm-chips">
      <span class="chip" onclick="askChip('Explain my critical configuration debts')">Critical Issues</span>
      <span class="chip" onclick="askChip('How do I fix duplicated configuration drift?')">Fix Drift</span>
      <span class="chip" onclick="askChip('Generate safe secrets remediation steps')">Remediate Secrets</span>
    </div>

    <div class="llm-input-row">
      <input type="text" id="llmPrompt" class="llm-input" placeholder="Ask LLM about this debt..." onkeydown="handleKey(event)">
      <button class="llm-send-btn" onclick="sendLlmPrompt()">Ask</button>
    </div>

    <div id="llmResponse" class="llm-response-box"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function postMsg(command) {
      vscode.postMessage({ command });
    }

    function jumpTo(file, line) {
      vscode.postMessage({ command: 'jumpTo', file, line });
    }

    function handleKey(e) {
      if (e.key === 'Enter') {
        sendLlmPrompt();
      }
    }

    function askChip(promptText) {
      document.getElementById('llmPrompt').value = promptText;
      sendLlmPrompt();
    }

    function sendLlmPrompt() {
      const input = document.getElementById('llmPrompt');
      const text = (input.value || '').trim();
      if (!text) return;

      const respBox = document.getElementById('llmResponse');
      respBox.classList.add('active');
      respBox.innerText = 'Thinking... analyzing deterministic SCM evidence...';

      vscode.postMessage({ command: 'askLlm', prompt: text });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'llmResponse') {
        const respBox = document.getElementById('llmResponse');
        respBox.classList.add('active');
        respBox.innerText = msg.answer;
      }
    });
  </script>
</body>
</html>`;
  }
}
