/**
 * Configuration Debt Tracker - Sidebar Webview Provider
 * Activity bar sidebar companion view with health glance, severity pills, and top backlog items.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { ScanResult } from '../models/scan';
import { ScanService } from '../services/scanService';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'configDebt.sidebarView';
  private view?: vscode.WebviewView;
  private currentResult: ScanResult | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    _scanService: ScanService
  ) {}

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

    webviewView.webview.html = this.getHtmlContent();

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
      }
    });
  }

  public updateResult(result: ScanResult): void {
    this.currentResult = result;
    if (this.view) {
      this.view.webview.html = this.getHtmlContent();
    }
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

  private getHtmlContent(): string {
    const res = this.currentResult;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg: var(--vscode-sideBar-background, #252526);
      --fg: var(--vscode-sideBar-foreground, #cccccc);
      --border: var(--vscode-widget-border, #3e3e42);
      --accent: var(--vscode-button-background, #0e639c);
      --accent-fg: var(--vscode-button-foreground, #ffffff);
      --subtle: var(--vscode-descriptionForeground, #858585);
      --font-mono: var(--vscode-editor-font-family, Menlo, Monaco, monospace);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, sans-serif);
      font-size: 12px;
      padding: 12px;
      line-height: 1.4;
    }
    .btn {
      width: 100%;
      background: var(--accent);
      color: var(--accent-fg);
      border: none;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 500;
      border-radius: 2px;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .btn.secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
    }
    .btn:hover { opacity: 0.9; }
    .health-box {
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 2px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .health-val {
      font-size: 26px;
      font-weight: 700;
      font-family: var(--font-mono);
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .sev-pills {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }
    .pill {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      padding: 6px 8px;
      border-radius: 2px;
      font-size: 11px;
    }
    .pill.crit { border-left: 3px solid #f14c4c; }
    .pill.high { border-left: 3px solid #e88500; }
    .pill.med { border-left: 3px solid #cca700; }
    .pill.low { border-left: 3px solid #3794ff; }
    .item-card {
      border: 1px solid var(--border);
      padding: 8px;
      border-radius: 2px;
      margin-bottom: 6px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.01);
    }
    .item-card:hover {
      border-color: var(--fg);
    }
    .item-key {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--fg);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-sub {
      color: var(--subtle);
      font-size: 10px;
      margin-top: 2px;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <button class="btn" onclick="postMsg('scan')">Scan Workspace</button>
  <button class="btn secondary" onclick="postMsg('openDashboard')">Open Full Dashboard</button>

  ${!res ? `
    <div style="padding: 16px 0; text-align: center; color: var(--subtle);">
      No scan results yet.<br>Click Scan Workspace to analyze configuration debt.
    </div>
  ` : `
    <div class="health-box">
      <div style="font-size: 10px; text-transform: uppercase; color: var(--subtle); font-weight: 600;">Configuration Health</div>
      <div class="health-val">
        <span>${res.healthScore.score}</span>
        <span style="font-size: 12px; color: var(--subtle);">/ 100</span>
        <span style="font-size: 12px; font-weight: 600; margin-left: 6px; color: ${res.healthScore.score >= 80 ? '#3fb950' : res.healthScore.score >= 60 ? '#cca700' : '#f14c4c'};">
          ${res.healthScore.grade}
        </span>
      </div>
      <div style="font-size: 10px; color: var(--subtle); margin-top: 4px;">
        ${res.findings.length} findings &bull; ${res.items.length} items
      </div>
    </div>

    <div class="sev-pills">
      <div class="pill crit">Critical: <strong>${res.inventory.bySeverity.critical}</strong></div>
      <div class="pill high">High: <strong>${res.inventory.bySeverity.high}</strong></div>
      <div class="pill med">Medium: <strong>${res.inventory.bySeverity.medium}</strong></div>
      <div class="pill low">Low: <strong>${res.inventory.bySeverity.low}</strong></div>
    </div>

    <div style="font-size: 10px; text-transform: uppercase; color: var(--subtle); font-weight: 600; margin: 12px 0 6px 0;">
      Top Priority Cleanup
    </div>

    ${res.cleanupItems.slice(0, 6).map(item => `
      <div class="item-card" onclick="jumpTo('${item.file}', ${item.line})">
        <div class="item-key">${item.key}</div>
        <div class="item-sub">
          <span>${item.file}:${item.line}</span>
          <span style="font-family: var(--font-mono); font-weight: 700; color: ${item.severity === 'critical' ? '#f14c4c' : item.severity === 'high' ? '#e88500' : '#cca700'}">Risk ${item.riskScore}</span>
        </div>
      </div>
    `).join('')}
  `}

  <script>
    const vscode = acquireVsCodeApi();
    function postMsg(command) { vscode.postMessage({ command }); }
    function jumpTo(file, line) { vscode.postMessage({ command: 'jumpTo', file, line }); }
  </script>
</body>
</html>`;
  }
}
