/**
 * Configuration Debt Tracker - Dashboard HTML & CSS Generator
 * Professional engineering diagnostic UI adhering to VS Code, Sentry, and Linear design principles.
 * NO generic AI dashboard widgets, NO purple gradients, NO floating blobs.
 */

import { ScanHistoryEntry, ScanResult } from '../models/scan';

export function getDashboardHtml(scanResult: ScanResult | null, history: ScanHistoryEntry[], isScanning: boolean): string {
  const resultJson = JSON.stringify(scanResult || null).replace(/</g, '\\u003c');
  const historyJson = JSON.stringify(history).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configuration Debt Dashboard</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #cccccc);
      --card-bg: var(--vscode-sideBar-background, #252526);
      --border: var(--vscode-widget-border, #3e3e42);
      --subtle: var(--vscode-descriptionForeground, #858585);
      --accent: var(--vscode-button-background, #0e639c);
      --accent-hover: var(--vscode-button-hoverBackground, #1177bb);
      --accent-fg: var(--vscode-button-foreground, #ffffff);

      /* Severity Colors - Exact engineering diagnostic semantics */
      --sev-crit-bg: rgba(241, 76, 76, 0.15);
      --sev-crit-border: #f14c4c;
      --sev-crit-fg: #f14c4c;

      --sev-high-bg: rgba(232, 133, 0, 0.15);
      --sev-high-border: #e88500;
      --sev-high-fg: #e88500;

      --sev-med-bg: rgba(204, 167, 0, 0.15);
      --sev-med-border: #cca700;
      --sev-med-fg: #cca700;

      --sev-low-bg: rgba(55, 148, 255, 0.15);
      --sev-low-border: #3794ff;
      --sev-low-fg: #3794ff;

      --font-mono: var(--vscode-editor-font-family, Menlo, Monaco, 'Courier New', monospace);
      --font-sans: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: var(--vscode-font-size, 13px);
      line-height: 1.5;
      padding: 16px 24px;
      overflow-y: auto;
    }

    /* Layout Header */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 18px;
    }

    .title-group h1 {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.2px;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .title-group .meta {
      font-size: 11px;
      color: var(--subtle);
      margin-top: 2px;
    }

    .btn-group {
      display: flex;
      gap: 8px;
    }

    button.btn {
      background: var(--accent);
      color: var(--accent-fg);
      border: 1px solid transparent;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 2px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.1s ease;
    }

    button.btn:hover {
      background: var(--accent-hover);
    }

    button.btn.secondary {
      background: transparent;
      color: var(--fg);
      border: 1px solid var(--border);
    }

    button.btn.secondary:hover {
      background: var(--card-bg);
    }

    button.btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Top Grid: Health Score + Severity + Inventory */
    .top-grid {
      display: grid;
      grid-template-columns: 240px 1fr 340px;
      gap: 16px;
      margin-bottom: 20px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 14px 16px;
    }

    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--subtle);
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Health Card */
    .health-display {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .health-num {
      font-size: 38px;
      font-weight: 700;
      font-family: var(--font-mono);
      line-height: 1;
    }

    .health-max {
      font-size: 16px;
      color: var(--subtle);
    }

    .health-status {
      font-size: 13px;
      font-weight: 600;
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .delta-badge {
      font-size: 11px;
      font-family: var(--font-mono);
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 2px;
    }

    .delta-plus {
      background: rgba(46, 160, 67, 0.15);
      color: #3fb950;
      border: 1px solid rgba(46, 160, 67, 0.4);
    }

    .delta-minus {
      background: rgba(241, 76, 76, 0.15);
      color: #f14c4c;
      border: 1px solid rgba(241, 76, 76, 0.4);
    }

    /* Severity Row */
    .severity-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      height: calc(100% - 24px);
      align-items: center;
    }

    .sev-box {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .sev-box:hover, .sev-box.active {
      border-color: var(--fg);
    }

    .sev-box.critical { border-left: 3px solid var(--sev-crit-border); }
    .sev-box.high { border-left: 3px solid var(--sev-high-border); }
    .sev-box.medium { border-left: 3px solid var(--sev-med-border); }
    .sev-box.low { border-left: 3px solid var(--sev-low-border); }

    .sev-box .sev-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .sev-box.critical .sev-label { color: var(--sev-crit-fg); }
    .sev-box.high .sev-label { color: var(--sev-high-fg); }
    .sev-box.medium .sev-label { color: var(--sev-med-fg); }
    .sev-box.low .sev-label { color: var(--sev-low-fg); }

    .sev-box .sev-count {
      font-size: 24px;
      font-weight: 700;
      font-family: var(--font-mono);
      margin-top: 4px;
      color: var(--fg);
    }

    /* Inventory Grid */
    .inventory-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      font-size: 12px;
    }

    .inv-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.06);
    }

    .inv-val {
      font-family: var(--font-mono);
      font-weight: 600;
    }

    /* Main Tabs and Content */
    .tab-bar {
      display: flex;
      gap: 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 14px;
    }

    .tab-btn {
      background: none;
      border: none;
      color: var(--subtle);
      font-size: 13px;
      font-weight: 500;
      padding: 8px 4px;
      cursor: pointer;
      position: relative;
    }

    .tab-btn:hover { color: var(--fg); }
    .tab-btn.active {
      color: var(--fg);
      font-weight: 600;
    }

    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent);
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
      align-items: center;
    }

    .search-input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 5px 10px;
      font-size: 12px;
      border-radius: 2px;
      flex: 1;
      max-width: 320px;
    }

    .search-input:focus {
      outline: 1px solid var(--accent);
      border-color: var(--accent);
    }

    .select-input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 5px 10px;
      font-size: 12px;
      border-radius: 2px;
    }

    /* Dense Data Table */
    .table-container {
      border: 1px solid var(--border);
      border-radius: 2px;
      overflow-x: auto;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    table.data-table th {
      background: var(--card-bg);
      padding: 8px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--subtle);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    table.data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    table.data-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    table.data-table tr:last-child td {
      border-bottom: none;
    }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 2px;
      text-transform: uppercase;
      font-family: var(--font-mono);
      letter-spacing: 0.3px;
    }

    .badge.critical { background: var(--sev-crit-bg); color: var(--sev-crit-fg); border: 1px solid var(--sev-crit-border); }
    .badge.high { background: var(--sev-high-bg); color: var(--sev-high-fg); border: 1px solid var(--sev-high-border); }
    .badge.medium { background: var(--sev-med-bg); color: var(--sev-med-fg); border: 1px solid var(--sev-med-border); }
    .badge.low { background: var(--sev-low-bg); color: var(--sev-low-fg); border: 1px solid var(--sev-low-border); }

    .key-cell {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--fg);
      cursor: pointer;
    }

    .key-cell:hover {
      text-decoration: underline;
      color: var(--accent-hover);
    }

    .file-loc {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--subtle);
      cursor: pointer;
    }

    .file-loc:hover {
      text-decoration: underline;
      color: var(--fg);
    }

    .status-select {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 2px;
    }

    .action-links {
      display: flex;
      gap: 8px;
    }

    .action-link {
      background: none;
      border: none;
      color: var(--subtle);
      font-size: 11px;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
    }

    .action-link:hover { color: var(--fg); }

    /* Detail Modal Drawer */
    .drawer-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      z-index: 100;
      justify-content: flex-end;
    }

    .drawer-overlay.active {
      display: flex;
    }

    .drawer {
      background: var(--bg);
      border-left: 1px solid var(--border);
      width: 560px;
      height: 100%;
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: -4px 0 16px rgba(0,0,0,0.4);
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }

    .drawer-header h2 {
      font-size: 15px;
      font-weight: 600;
    }

    .drawer-header .close-btn {
      background: none;
      border: none;
      color: var(--subtle);
      font-size: 16px;
      cursor: pointer;
    }

    .drawer-section {
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 12px 14px;
      background: var(--card-bg);
    }

    .drawer-section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--subtle);
      font-weight: 600;
      margin-bottom: 8px;
    }

    .score-breakdown-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      font-size: 11px;
      text-align: center;
      margin-top: 8px;
    }

    .score-col {
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 6px;
      border-radius: 2px;
    }

    .score-col .num {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 14px;
      margin-top: 2px;
    }

    /* AI Box */
    .ai-box {
      border: 1px solid var(--border);
      background: var(--card-bg);
      border-radius: 2px;
      padding: 12px;
      font-size: 12px;
      line-height: 1.6;
    }

    .ai-header {
      font-size: 11px;
      font-weight: 600;
      color: var(--subtle);
      text-transform: uppercase;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }

    /* History Sparkline */
    .sparkline-svg {
      width: 100%;
      height: 70px;
    }

    /* Empty state */
    .empty-state {
      padding: 48px 16px;
      text-align: center;
      color: var(--subtle);
      border: 1px dashed var(--border);
      border-radius: 2px;
    }

    .empty-state h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--fg);
      margin-bottom: 6px;
    }

    /* Scanning Progress Overlay */
    .scanning-bar {
      display: none;
      background: var(--card-bg);
      border: 1px solid var(--accent);
      padding: 10px 14px;
      margin-bottom: 14px;
      border-radius: 2px;
      font-size: 12px;
      align-items: center;
      gap: 12px;
    }

    .scanning-bar.active {
      display: flex;
    }

    .progress-track {
      flex: 1;
      height: 4px;
      background: var(--bg);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      width: 0%;
      background: var(--accent);
      transition: width 0.2s ease;
    }
  </style>
</head>
<body>

  <!-- Scanning Progress Indicator -->
  <div id="scanningBar" class="scanning-bar ${isScanning ? 'active' : ''}">
    <span id="scanStageText" style="font-weight:600;">Scanning workspace...</span>
    <div class="progress-track"><div id="scanProgressBar" class="progress-fill"></div></div>
    <span id="scanDetailText" style="color:var(--subtle); font-family:var(--font-mono); font-size:11px;">Initializing...</span>
  </div>

  <!-- Header -->
  <div class="header-bar">
    <div class="title-group">
      <h1>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L4 5v6.5C4 16.5 7.5 21 12 22c4.5-1 8-5.5 8-10.5V5L12 2z"/>
          <line x1="8" y1="9" x2="16" y2="9"/>
          <line x1="8" y1="14" x2="16" y2="14"/>
        </svg>
        Configuration Debt Tracker
      </h1>
      <div class="meta" id="headerMeta">
        Workspace: <strong style="color:var(--fg);">${scanResult?.workspaceName || 'Ready'}</strong>
        &nbsp;&bull;&nbsp;
        Last scan: <span id="lastScanTime">${scanResult ? new Date(scanResult.timestamp).toLocaleTimeString() : 'Never'}</span>
      </div>
    </div>
    <div class="btn-group">
      <button class="btn" id="btnScan" onclick="triggerScan()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
        Scan Workspace
      </button>
      <button class="btn secondary" id="btnRefresh" onclick="triggerRefresh()">Refresh</button>
    </div>
  </div>

  ${!scanResult ? `
    <div class="empty-state">
      <h3>No Configuration Debt Analysis Found</h3>
      <p style="margin-bottom: 14px;">Scan this workspace to inventory configurations, analyze source-code usage, and detect configuration debt.</p>
      <button class="btn" onclick="triggerScan()">Start Initial Workspace Scan</button>
    </div>
  ` : `

    <!-- Top Grid: Health Score, Severity, Inventory -->
    <div class="top-grid">
      <!-- Health Card -->
      <div class="card">
        <div class="card-title">
          <span>Configuration Health</span>
          <span style="font-size:10px; font-weight:normal; text-transform:none;">SCM Audit</span>
        </div>
        <div class="health-display">
          <div class="health-num" id="healthScoreNum">${scanResult.healthScore.score}</div>
          <div class="health-max">/ 100</div>
        </div>
        <div class="health-status">
          <span id="healthGrade">${scanResult.healthScore.grade}</span>
          ${history.length > 1 && history[history.length - 1].deltaFromPrevious !== undefined ? `
            <span class="delta-badge ${history[history.length - 1].deltaFromPrevious! >= 0 ? 'delta-plus' : 'delta-minus'}">
              ${history[history.length - 1].deltaFromPrevious! >= 0 ? '+' : ''}${history[history.length - 1].deltaFromPrevious}
            </span>
          ` : ''}
        </div>
        <div style="font-size:11px; color:var(--subtle); margin-top:8px; line-height:1.3;">
          ${scanResult.findings.length} debt finding(s) detected across ${scanResult.inventory.totalItems} configuration item(s).
        </div>
      </div>

      <!-- Severity Boxes -->
      <div class="card">
        <div class="card-title">Severity Breakdown</div>
        <div class="severity-row">
          <div class="sev-box critical" onclick="filterSeverity('critical')">
            <div class="sev-label">Critical</div>
            <div class="sev-count">${scanResult.inventory.bySeverity.critical}</div>
          </div>
          <div class="sev-box high" onclick="filterSeverity('high')">
            <div class="sev-label">High</div>
            <div class="sev-count">${scanResult.inventory.bySeverity.high}</div>
          </div>
          <div class="sev-box medium" onclick="filterSeverity('medium')">
            <div class="sev-label">Medium</div>
            <div class="sev-count">${scanResult.inventory.bySeverity.medium}</div>
          </div>
          <div class="sev-box low" onclick="filterSeverity('low')">
            <div class="sev-label">Low</div>
            <div class="sev-count">${scanResult.inventory.bySeverity.low}</div>
          </div>
        </div>
      </div>

      <!-- Configuration Overview / Inventory -->
      <div class="card">
        <div class="card-title">Configuration Overview</div>
        <div class="inventory-list">
          <div class="inv-row"><span>Total items</span><span class="inv-val">${scanResult.inventory.totalItems}</span></div>
          <div class="inv-row"><span>Used in source</span><span class="inv-val" style="color:#3fb950;">${scanResult.inventory.usedItems}</span></div>
          <div class="inv-row"><span>Unused / Dead</span><span class="inv-val" style="color:var(--sev-crit-fg);">${scanResult.inventory.unusedItems}</span></div>
          <div class="inv-row"><span>Duplicates</span><span class="inv-val" style="color:var(--sev-high-fg);">${scanResult.inventory.duplicateItems}</span></div>
          <div class="inv-row"><span>Secrets</span><span class="inv-val" style="color:var(--sev-crit-fg);">${scanResult.inventory.secretItems}</span></div>
          <div class="inv-row"><span>Undocumented</span><span class="inv-val" style="color:var(--sev-med-fg);">${scanResult.inventory.undocumentedItems}</span></div>
        </div>
      </div>
    </div>

    <!-- Main Navigation Tabs -->
    <div class="tab-bar">
      <button class="tab-btn active" id="tabBacklog" onclick="switchTab('backlog')">
        Cleanup Backlog (${scanResult.cleanupItems.length})
      </button>
      <button class="tab-btn" id="tabFindings" onclick="switchTab('findings')">
        All Findings (${scanResult.findings.length})
      </button>
      <button class="tab-btn" id="tabInventory" onclick="switchTab('inventory')">
        Configuration Inventory (${scanResult.items.length})
      </button>
      <button class="tab-btn" id="tabHistory" onclick="switchTab('history')">
        Health Trend & History (${history.length})
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <input type="text" id="searchInput" class="search-input" placeholder="Filter by key, category, or file..." oninput="applyFilters()">
      <select id="severityFilter" class="select-input" onchange="applyFilters()">
        <option value="all">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select id="categoryFilter" class="select-input" onchange="applyFilters()">
        <option value="all">All Categories</option>
        <option value="dead_configuration">Dead Configuration</option>
        <option value="duplicated_configuration">Duplicated Configuration</option>
        <option value="hardcoded_secret">Hardcoded Secret</option>
        <option value="stale_configuration">Stale Configuration</option>
        <option value="undocumented_configuration">Undocumented</option>
      </select>
      <select id="statusFilter" class="select-input" onchange="applyFilters()">
        <option value="all">All Statuses</option>
        <option value="open">Open</option>
        <option value="needs_review">Needs Review</option>
        <option value="resolved">Resolved</option>
        <option value="ignored">Ignored</option>
      </select>
    </div>

    <!-- TAB 1: Cleanup Backlog -->
    <div id="viewBacklog" class="tab-view">
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;">Prio</th>
              <th style="width:70px;">Risk</th>
              <th style="width:80px;">Severity</th>
              <th>Configuration Key</th>
              <th>Category</th>
              <th>Location</th>
              <th>Suggested Remediation</th>
              <th style="width:110px;">Status</th>
              <th style="width:140px;">Actions</th>
            </tr>
          </thead>
          <tbody id="backlogTbody">
            <!-- Dynamically populated via JS -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: All Findings -->
    <div id="viewFindings" class="tab-view" style="display:none;">
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:70px;">Risk</th>
              <th style="width:80px;">Severity</th>
              <th>Configuration Key</th>
              <th>Category</th>
              <th>Location</th>
              <th>Evidence Summary</th>
              <th style="width:100px;">Actions</th>
            </tr>
          </thead>
          <tbody id="findingsTbody">
            <!-- Dynamically populated via JS -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: Inventory -->
    <div id="viewInventory" class="tab-view" style="display:none;">
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value (Masked)</th>
              <th>Format</th>
              <th>Location</th>
              <th>Source Usage</th>
              <th>Sensitivity</th>
              <th>Documentation</th>
            </tr>
          </thead>
          <tbody id="inventoryTbody">
            <!-- Dynamically populated via JS -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: Health Trend & History -->
    <div id="viewHistory" class="tab-view" style="display:none;">
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">Configuration Health Score Trend</div>
        <div id="trendChartContainer" style="padding: 10px 0;">
          <!-- SVG Trend Chart -->
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Health Score</th>
              <th>Delta</th>
              <th>Total Items</th>
              <th>Total Debt Items</th>
              <th>Critical</th>
              <th>High</th>
              <th>Medium</th>
              <th>Low</th>
            </tr>
          </thead>
          <tbody id="historyTbody">
            <!-- Dynamically populated via JS -->
          </tbody>
        </table>
      </div>
    </div>

  `}

  <!-- Detail Drawer Overlay -->
  <div id="drawerOverlay" class="drawer-overlay" onclick="closeDrawer(event)">
    <div class="drawer" id="drawerContent" onclick="event.stopPropagation()">
      <div class="drawer-header">
        <div>
          <span class="badge" id="drawerSevBadge">CRITICAL</span>
          <h2 id="drawerTitle" style="margin-top:4px;">Finding Details</h2>
        </div>
        <button class="close-btn" onclick="closeDrawer()">&times;</button>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Risk Score & Deterministic Breakdown</div>
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <div style="font-size:28px; font-weight:700; font-family:var(--font-mono);" id="drawerRiskTotal">82</div>
          <div style="font-size:12px; color:var(--subtle);" id="drawerFormula">Formula: 25% Age + 35% Usage + 25% Impact + 15% Sensitivity</div>
        </div>
        <div class="score-breakdown-grid">
          <div class="score-col">
            <span style="color:var(--subtle);">Age (25%)</span>
            <div class="num" id="drawerAgeScore">22</div>
          </div>
          <div class="score-col">
            <span style="color:var(--subtle);">Usage (35%)</span>
            <div class="num" id="drawerUsageScore">30</div>
          </div>
          <div class="score-col">
            <span style="color:var(--subtle);">Impact (25%)</span>
            <div class="num" id="drawerImpactScore">18</div>
          </div>
          <div class="score-col">
            <span style="color:var(--subtle);">Sensitivity (15%)</span>
            <div class="num" id="drawerSensScore">12</div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Location & Metadata</div>
        <div style="font-size:12px; line-height:1.6;">
          <div>Key: <strong id="drawerKey" style="font-family:var(--font-mono);"></strong></div>
          <div>Location: <span id="drawerLocation" class="file-loc" style="text-decoration:underline;"></span></div>
          <div>Category: <span id="drawerCategory"></span></div>
          <div>Confidence: <span id="drawerConfidence" style="font-family:var(--font-mono); font-weight:600;"></span></div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Deterministic Evidence</div>
        <ul id="drawerEvidenceList" style="padding-left:18px; font-size:12px; line-height:1.6; color:var(--fg);">
        </ul>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Recommended Remediation</div>
        <p id="drawerRecommendation" style="font-size:12px; line-height:1.6;"></p>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn" id="drawerJumpBtn">Open File at Line</button>
          <button class="btn secondary" id="drawerExplainBtn">Explain with AI</button>
        </div>
      </div>

      <!-- AI Explainer Box in Drawer -->
      <div id="drawerAiBox" class="ai-box" style="display:none;">
        <div class="ai-header">
          <span>AI Explanation & Architectural Guidance</span>
          <span id="aiProviderTag" style="font-family:var(--font-mono); font-size:10px;">Deterministic</span>
        </div>
        <div id="aiContent" style="white-space: pre-wrap;"></div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const scanData = ${resultJson};
    const historyData = ${historyJson};

    let activeTab = 'backlog';
    let currentSeverityFilter = 'all';

    function triggerScan() {
      vscode.postMessage({ command: 'scanWorkspace' });
    }

    function triggerRefresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function jumpTo(file, line) {
      vscode.postMessage({ command: 'jumpTo', file, line });
    }

    function updateStatus(findingId, status) {
      vscode.postMessage({ command: 'updateStatus', findingId, status });
    }

    function requestExplain(findingId) {
      vscode.postMessage({ command: 'explain', findingId });
    }

    function switchTab(tab) {
      activeTab = tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');

      if (tab === 'backlog') {
        document.getElementById('tabBacklog').classList.add('active');
        document.getElementById('viewBacklog').style.display = 'block';
      } else if (tab === 'findings') {
        document.getElementById('tabFindings').classList.add('active');
        document.getElementById('viewFindings').style.display = 'block';
      } else if (tab === 'inventory') {
        document.getElementById('tabInventory').classList.add('active');
        document.getElementById('viewInventory').style.display = 'block';
      } else if (tab === 'history') {
        document.getElementById('tabHistory').classList.add('active');
        document.getElementById('viewHistory').style.display = 'block';
        renderHistoryChart();
      }
      applyFilters();
    }

    function filterSeverity(sev) {
      currentSeverityFilter = currentSeverityFilter === sev ? 'all' : sev;
      document.getElementById('severityFilter').value = currentSeverityFilter;
      document.querySelectorAll('.sev-box').forEach(b => {
        b.classList.toggle('active', b.classList.contains(currentSeverityFilter));
      });
      applyFilters();
    }

    function applyFilters() {
      if (!scanData) return;
      const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
      const sev = document.getElementById('severityFilter')?.value || 'all';
      const cat = document.getElementById('categoryFilter')?.value || 'all';
      const status = document.getElementById('statusFilter')?.value || 'all';

      renderBacklog(q, sev, cat, status);
      renderFindings(q, sev, cat);
      renderInventory(q);
      renderHistoryTable();
    }

    function renderBacklog(q, sev, cat, status) {
      const tbody = document.getElementById('backlogTbody');
      if (!tbody || !scanData) return;
      tbody.innerHTML = '';

      const items = scanData.cleanupItems.filter(item => {
        if (sev !== 'all' && item.severity !== sev) return false;
        if (status !== 'all' && item.status !== status) return false;
        if (cat !== 'all') {
          const finding = scanData.findings.find(f => f.id === item.findingId);
          if (finding && finding.category !== cat) return false;
        }
        if (q) {
          const match = item.key.toLowerCase().includes(q) ||
                        item.file.toLowerCase().includes(q) ||
                        item.category.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });

      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--subtle); padding:24px;">No backlog items match the selected filter.</td></tr>';
        return;
      }

      items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td style="font-family:var(--font-mono); font-weight:600; color:var(--subtle);">#\${item.priority}</td>
          <td style="font-family:var(--font-mono); font-weight:700;">\${item.riskScore}</td>
          <td><span class="badge \${item.severity}">\${item.severity}</span></td>
          <td><span class="key-cell" onclick="openFindingDetail('\${item.findingId}')">\${item.key}</span></td>
          <td style="color:var(--subtle);">\${item.category}</td>
          <td><span class="file-loc" onclick="jumpTo('\${item.file}', \${item.line})">\${item.file}:\${item.line}</span></td>
          <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="\${item.suggestedAction}">\${item.suggestedAction}</td>
          <td>
            <select class="status-select" onchange="updateStatus('\${item.findingId}', this.value)">
              <option value="open" \${item.status === 'open' ? 'selected' : ''}>Open</option>
              <option value="needs_review" \${item.status === 'needs_review' ? 'selected' : ''}>Needs Review</option>
              <option value="resolved" \${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
              <option value="ignored" \${item.status === 'ignored' ? 'selected' : ''}>Ignored</option>
            </select>
          </td>
          <td>
            <div class="action-links">
              <button class="action-link" onclick="openFindingDetail('\${item.findingId}')">Details</button>
              <button class="action-link" onclick="jumpTo('\${item.file}', \${item.line})">Jump</button>
              <button class="action-link" onclick="requestExplain('\${item.findingId}')">AI Explain</button>
            </div>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderFindings(q, sev, cat) {
      const tbody = document.getElementById('findingsTbody');
      if (!tbody || !scanData) return;
      tbody.innerHTML = '';

      const findings = scanData.findings.filter(f => {
        if (sev !== 'all' && f.severity !== sev) return false;
        if (cat !== 'all' && f.category !== cat) return false;
        if (q) {
          const match = f.configurationItem.key.toLowerCase().includes(q) ||
                        f.configurationItem.filePath.toLowerCase().includes(q) ||
                        f.categoryLabel.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });

      if (findings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--subtle); padding:24px;">No findings match the selected filter.</td></tr>';
        return;
      }

      findings.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td style="font-family:var(--font-mono); font-weight:700;">\${f.riskScore}</td>
          <td><span class="badge \${f.severity}">\${f.severity}</span></td>
          <td><span class="key-cell" onclick="openFindingDetail('\${f.id}')">\${f.configurationItem.key}</span></td>
          <td style="color:var(--subtle);">\${f.categoryLabel}</td>
          <td><span class="file-loc" onclick="jumpTo('\${f.configurationItem.filePath}', \${f.configurationItem.line})">\${f.configurationItem.filePath}:\${f.configurationItem.line}</span></td>
          <td style="color:var(--fg); max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="\${f.evidence.join(' ')}">\${f.evidence[0]}</td>
          <td>
            <div class="action-links">
              <button class="action-link" onclick="openFindingDetail('\${f.id}')">Inspect</button>
              <button class="action-link" onclick="jumpTo('\${f.configurationItem.filePath}', \${f.configurationItem.line})">Jump</button>
            </div>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderInventory(q) {
      const tbody = document.getElementById('inventoryTbody');
      if (!tbody || !scanData) return;
      tbody.innerHTML = '';

      const items = scanData.items.filter(item => {
        if (q) {
          return item.key.toLowerCase().includes(q) || item.filePath.toLowerCase().includes(q);
        }
        return true;
      });

      items.forEach(item => {
        const usage = scanData.usageMap[item.key];
        const isUsed = usage ? usage.isUsed : false;
        const refCount = usage ? usage.referenceCount : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td style="font-family:var(--font-mono); font-weight:600;">\${item.key}</td>
          <td style="font-family:var(--font-mono); color:var(--subtle); font-size:11px;">\${item.maskedValue || '—'}</td>
          <td><span style="font-size:11px; text-transform:uppercase; color:var(--subtle);">\${item.format}</span></td>
          <td><span class="file-loc" onclick="jumpTo('\${item.filePath}', \${item.line})">\${item.filePath}:\${item.line}</span></td>
          <td>
            <span style="color:\${isUsed ? '#3fb950' : 'var(--sev-crit-fg)'}; font-weight:600;">
              \${isUsed ? 'Used (' + refCount + ')' : 'Unused (0)'}
            </span>
          </td>
          <td><span style="font-size:11px; color:var(--subtle);">\${item.sensitivity}</span></td>
          <td style="color:var(--subtle); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${item.documentation || '—'}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderHistoryTable() {
      const tbody = document.getElementById('historyTbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      historyData.slice().reverse().forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${h.formattedDate}</td>
          <td style="font-family:var(--font-mono); font-weight:700;">\${h.healthScore} / 100</td>
          <td>
            \${h.deltaFromPrevious !== undefined ? \`
              <span class="delta-badge \${h.deltaFromPrevious >= 0 ? 'delta-plus' : 'delta-minus'}">
                \${h.deltaFromPrevious >= 0 ? '+' : ''}\${h.deltaFromPrevious}
              </span>
            \` : '—'}
          </td>
          <td style="font-family:var(--font-mono);">\${h.totalItems}</td>
          <td style="font-family:var(--font-mono); font-weight:600;">\${h.totalFindings}</td>
          <td style="color:var(--sev-crit-fg); font-weight:600;">\${h.criticalCount}</td>
          <td style="color:var(--sev-high-fg); font-weight:600;">\${h.highCount}</td>
          <td style="color:var(--sev-med-fg); font-weight:600;">\${h.mediumCount}</td>
          <td style="color:var(--sev-low-fg); font-weight:600;">\${h.lowCount}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderHistoryChart() {
      const container = document.getElementById('trendChartContainer');
      if (!container) return;
      if (historyData.length === 0) {
        container.innerHTML = '<div style="color:var(--subtle); font-size:12px;">No scan history recorded yet.</div>';
        return;
      }

      const points = historyData.slice(-15);
      const width = container.clientWidth || 600;
      const height = 80;
      const padding = 20;

      const minScore = 0;
      const maxScore = 100;

      let d = '';
      points.forEach((pt, idx) => {
        const x = padding + (idx / Math.max(1, points.length - 1)) * (width - padding * 2);
        const y = height - padding - ((pt.healthScore - minScore) / (maxScore - minScore)) * (height - padding * 2);
        d += (idx === 0 ? 'M' : 'L') + \` \${x} \${y} \`;
      });

      let svg = \`<svg class="sparkline-svg" viewBox="0 0 \${width} \${height}">
        <path d="\${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" />
      \`;

      points.forEach((pt, idx) => {
        const x = padding + (idx / Math.max(1, points.length - 1)) * (width - padding * 2);
        const y = height - padding - ((pt.healthScore - minScore) / (maxScore - minScore)) * (height - padding * 2);
        svg += \`<circle cx="\${x}" cy="\${y}" r="4" fill="var(--bg)" stroke="var(--accent)" stroke-width="2" />\`;
        svg += \`<text x="\${x}" y="\${y - 8}" font-size="10" font-family="var(--font-mono)" fill="var(--fg)" text-anchor="middle">\${pt.healthScore}</text>\`;
      });

      svg += \`</svg>\`;
      container.innerHTML = svg;
    }

    function openFindingDetail(findingId) {
      if (!scanData) return;
      const f = scanData.findings.find(item => item.id === findingId);
      if (!f) return;

      document.getElementById('drawerSevBadge').className = 'badge ' + f.severity;
      document.getElementById('drawerSevBadge').innerText = f.severity.toUpperCase();
      document.getElementById('drawerTitle').innerText = f.title;
      document.getElementById('drawerRiskTotal').innerText = f.riskScore;
      document.getElementById('drawerAgeScore').innerText = f.riskBreakdown.ageScore;
      document.getElementById('drawerUsageScore').innerText = f.riskBreakdown.usageScore;
      document.getElementById('drawerImpactScore').innerText = f.riskBreakdown.impactScore;
      document.getElementById('drawerSensScore').innerText = f.riskBreakdown.sensitivityScore;

      document.getElementById('drawerKey').innerText = f.configurationItem.key;
      const locEl = document.getElementById('drawerLocation');
      locEl.innerText = \`\${f.configurationItem.filePath}:\${f.configurationItem.line}\`;
      locEl.onclick = () => jumpTo(f.configurationItem.filePath, f.configurationItem.line);

      document.getElementById('drawerCategory').innerText = f.categoryLabel;
      document.getElementById('drawerConfidence').innerText = f.confidence + '%';

      const evList = document.getElementById('drawerEvidenceList');
      evList.innerHTML = '';
      f.evidence.forEach(ev => {
        const li = document.createElement('li');
        li.innerText = ev;
        evList.appendChild(li);
      });

      document.getElementById('drawerRecommendation').innerText = f.recommendation;

      const jumpBtn = document.getElementById('drawerJumpBtn');
      jumpBtn.onclick = () => jumpTo(f.configurationItem.filePath, f.configurationItem.line);

      const explainBtn = document.getElementById('drawerExplainBtn');
      explainBtn.onclick = () => requestExplain(f.id);

      // Reset AI box
      document.getElementById('drawerAiBox').style.display = 'none';
      document.getElementById('drawerOverlay').classList.add('active');
    }

    function closeDrawer() {
      document.getElementById('drawerOverlay').classList.remove('active');
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'scanProgress') {
        const bar = document.getElementById('scanningBar');
        bar.classList.add('active');
        document.getElementById('scanStageText').innerText = msg.stage;
        document.getElementById('scanProgressBar').style.width = msg.percent + '%';
        document.getElementById('scanDetailText').innerText = msg.detail || '';
      } else if (msg.command === 'scanComplete') {
        const bar = document.getElementById('scanningBar');
        bar.classList.remove('active');
      } else if (msg.command === 'aiExplanation') {
        const aiBox = document.getElementById('drawerAiBox');
        aiBox.style.display = 'block';
        document.getElementById('aiProviderTag').innerText = msg.explanation.provider === 'gemini' ? 'Gemini 1.5' : 'Deterministic SCM';
        document.getElementById('aiContent').innerText =
          'SUMMARY:\\n' + msg.explanation.summary + '\\n\\n' +
          'WHY FLAGGED:\\n' + msg.explanation.whyFlagged + '\\n\\n' +
          'EVIDENCE ANALYSIS:\\n' + msg.explanation.evidenceExplanation + '\\n\\n' +
          'VERIFICATION CHECKLIST:\\n' + msg.explanation.verificationSteps.map((s, i) => (i+1) + '. ' + s).join('\\n') + '\\n\\n' +
          'REMEDIATION GUIDANCE:\\n' + msg.explanation.remediationAdvice;
      }
    });

    // Initial render
    applyFilters();
  </script>
</body>
</html>`;
}
