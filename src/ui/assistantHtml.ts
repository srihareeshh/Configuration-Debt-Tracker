/**
 * Configuration Debt Tracker - AI Assistant Webview HTML Generator
 * Clean, engineering-focused developer assistant UI adhering to VS Code native design tokens.
 * Supports multi-turn chat, markdown formatting, syntax code blocks, and clickable citations.
 */

export interface AssistantRenderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  provider?: string;
  modelUsed?: string;
  latencyMs?: number;
}

export function getAssistantHtml(
  messages: AssistantRenderMessage[],
  providerStatus: string,
  isGenerating: boolean = false,
  hasScan: boolean = true
): string {
  const initialMessagesJson = JSON.stringify(messages).replace(/</g, '\\u003c');
  const badgeClass = getBadgeClass(providerStatus);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configuration Debt Assistant</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --sidebar-bg: var(--vscode-sideBar-background, #252526);
      --border: var(--vscode-widget-border, #3c3c3c);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
      --btn-fg: var(--vscode-button-foreground, #ffffff);
      --badge-bg: var(--vscode-badge-background, #4d4d4d);
      --badge-fg: var(--vscode-badge-foreground, #ffffff);
      --code-bg: rgba(255, 255, 255, 0.06);
      --code-border: rgba(255, 255, 255, 0.12);
      --citation-bg: rgba(14, 99, 156, 0.25);
      --citation-border: #0e639c;
      --citation-hover: #1177bb;
      --font-mono: var(--vscode-editor-font-family, Menlo, Monaco, 'Courier New', monospace);
      --font-sans: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: var(--vscode-font-size, 13px);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--sidebar-bg);
      flex-shrink: 0;
    }

    .status-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--border);
    }

    .status-badge.connected {
      background: rgba(63, 185, 80, 0.15);
      color: #3fb950;
      border-color: #3fb950;
    }

    .status-badge.offline {
      background: rgba(163, 113, 247, 0.15);
      color: #a371f7;
      border-color: #a371f7;
    }

    .status-badge.warning {
      background: rgba(210, 153, 34, 0.15);
      color: #d29922;
      border-color: #d29922;
    }

    .status-badge.error {
      background: rgba(248, 81, 73, 0.15);
      color: #f85149;
      border-color: #f85149;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }

    .top-actions {
      display: flex;
      gap: 8px;
    }

    button.icon-action-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 3px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    button.icon-action-btn:hover {
      background: var(--code-bg);
      border-color: var(--btn-bg);
    }

    .unscanned-banner {
      background: rgba(210, 153, 34, 0.15);
      border-bottom: 1px solid #d29922;
      color: #d29922;
      padding: 8px 16px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .empty-chat {
      margin: auto;
      max-width: 600px;
      text-align: center;
      padding: 24px;
    }

    .empty-chat h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .empty-chat p {
      color: var(--vscode-descriptionForeground, #888);
      font-size: 13px;
      margin-bottom: 20px;
    }

    .chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .chip-btn {
      background: var(--sidebar-bg);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 7px 12px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
    }

    .chip-btn:hover {
      border-color: var(--btn-bg);
      background: var(--code-bg);
    }

    .message-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 900px;
      width: 100%;
    }

    .message-row.user {
      align-self: flex-end;
    }

    .message-row.assistant {
      align-self: flex-start;
    }

    .message-header {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground, #888);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .message-body {
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.6;
    }

    .message-row.user .message-body {
      background: var(--sidebar-bg);
      border: 1px solid var(--border);
      border-left: 3px solid var(--btn-bg);
    }

    .message-row.assistant .message-body {
      background: var(--code-bg);
      border: 1px solid var(--code-border);
      border-left: 3px solid #3fb950;
    }

    .message-body pre {
      background: #141414;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 10px 14px;
      overflow-x: auto;
      margin: 10px 0;
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .message-body code {
      font-family: var(--font-mono);
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 12px;
    }

    .message-body pre code {
      background: transparent;
      padding: 0;
    }

    .message-body p {
      margin-bottom: 8px;
    }

    .message-body p:last-child {
      margin-bottom: 0;
    }

    .message-body ul, .message-body ol {
      margin-left: 20px;
      margin-bottom: 8px;
    }

    .message-body li {
      margin-bottom: 4px;
    }

    .message-body strong {
      color: #ffffff;
    }

    .citation-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--citation-bg);
      border: 1px solid var(--citation-border);
      color: #58a6ff;
      padding: 1px 7px;
      border-radius: 3px;
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
      text-decoration: none;
      vertical-align: middle;
      margin: 1px 2px;
    }

    .citation-link:hover {
      background: var(--citation-hover);
      color: #ffffff;
      border-color: #ffffff;
    }

    .loading-indicator {
      display: none;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--code-bg);
      border: 1px dashed var(--border);
      border-radius: 6px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #888);
      max-width: 320px;
    }

    .loading-indicator.active {
      display: flex;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border);
      border-top-color: #58a6ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .input-footer {
      padding: 12px 20px 16px;
      background: var(--sidebar-bg);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .input-box-wrapper {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    textarea.chat-input {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 10px 12px;
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 1.4;
      resize: none;
      min-height: 44px;
      max-height: 140px;
      outline: none;
    }

    textarea.chat-input:focus {
      border-color: var(--btn-bg);
    }

    button.send-btn {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 4px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 44px;
      flex-shrink: 0;
    }

    button.send-btn:hover:not(:disabled) {
      background: var(--btn-hover);
    }

    button.send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-hint {
      margin-top: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #777);
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- Top Bar -->
  <div class="top-bar">
    <div class="status-group">
      <span id="providerBadge" class="status-badge ${badgeClass}">
        <span class="status-dot"></span>
        <span id="providerStatusText">${providerStatus}</span>
      </span>
    </div>
    <div class="top-actions">
      <button class="icon-action-btn" onclick="testConnection()">Test Connection</button>
      <button class="icon-action-btn" onclick="configureKey()">Set API Key</button>
      <button class="icon-action-btn" onclick="clearChat()">Clear Chat</button>
    </div>
  </div>

  ${
    !hasScan
      ? `
    <div class="unscanned-banner">
      <span>Workspace is not indexed. Run a scan to answer repository-grounded questions.</span>
      <button class="icon-action-btn" onclick="scanWorkspace()">Scan Workspace</button>
    </div>
  `
      : ''
  }

  <!-- Messages Scroll Area -->
  <div id="chatContainer" class="chat-container">
    <div id="emptyChat" class="empty-chat" style="${messages.length > 0 ? 'display:none;' : ''}">
      <h2>Configuration Debt Assistant</h2>
      <p>Ask repository-grounded questions about configurations, architecture, static references, and risk.</p>
      <div class="chips-grid">
        <button class="chip-btn" onclick="sendPrompt('Explain the architecture of this project.')">Explain the architecture of this project</button>
        <button class="chip-btn" onclick="sendPrompt('Where is DATABASE_URL used and what depends on it?')">Where is DATABASE_URL used?</button>
        <button class="chip-btn" onclick="sendPrompt('How is the health score calculated?')">How is the health score calculated?</button>
        <button class="chip-btn" onclick="sendPrompt('Explain how the configuration scanner works.')">Explain the configuration scanner</button>
        <button class="chip-btn" onclick="sendPrompt('Explain configuration drift in this project.')">Explain configuration drift</button>
        <button class="chip-btn" onclick="sendPrompt('Which configuration has the highest risk score?')">Highest risk configuration</button>
      </div>
    </div>

    <!-- Messages Will Be Inserted Here -->
    <div id="messagesList"></div>

    <div id="loadingIndicator" class="loading-indicator ${isGenerating ? 'active' : ''}">
      <div class="spinner"></div>
      <span id="loadingText">Retrieving repository evidence and generating answer...</span>
    </div>
  </div>

  <!-- Input Footer -->
  <div class="input-footer">
    <div class="input-box-wrapper">
      <textarea
        id="promptInput"
        class="chat-input"
        placeholder="Ask a question about the repository (e.g. 'Where is DATABASE_URL used?')..."
        rows="1"
        onkeydown="handleKeyDown(event)"
        oninput="autoResize(this)"
      ></textarea>
      <button id="sendBtn" class="send-btn" onclick="submitMessage()" ${isGenerating ? 'disabled' : ''}>
        Send
      </button>
    </div>
    <div class="input-hint">
      <span>Press Enter to send, Shift+Enter for new line</span>
      <span id="modelInfo">Provider: ${providerStatus}</span>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let isPending = ${isGenerating ? 'true' : 'false'};
    const initialMessages = ${initialMessagesJson};

    function renderInitialMessages() {
      const container = document.getElementById('messagesList');
      container.innerHTML = '';
      for (const m of initialMessages) {
        appendMessageElement(m.role, m.content, m.provider, m.modelUsed, m.latencyMs);
      }
      scrollToBottom();
    }

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }

    function handleKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitMessage();
      }
    }

    function submitMessage() {
      if (isPending) return;
      const input = document.getElementById('promptInput');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      input.style.height = 'auto';

      document.getElementById('emptyChat').style.display = 'none';
      appendMessageElement('user', text);
      setLoadingState(true);

      vscode.postMessage({
        command: 'askQuestion',
        text: text
      });
      scrollToBottom();
    }

    function sendPrompt(text) {
      const input = document.getElementById('promptInput');
      input.value = text;
      submitMessage();
    }

    function clearChat() {
      vscode.postMessage({ command: 'clearHistory' });
      document.getElementById('messagesList').innerHTML = '';
      document.getElementById('emptyChat').style.display = 'block';
    }

    function testConnection() {
      vscode.postMessage({ command: 'testConnection' });
    }

    function configureKey() {
      vscode.postMessage({ command: 'setApiKey' });
    }

    function scanWorkspace() {
      vscode.postMessage({ command: 'scanWorkspace' });
    }

    function jumpToCitation(file, line) {
      vscode.postMessage({ command: 'jumpTo', file: file, line: line });
    }

    function setLoadingState(loading) {
      isPending = loading;
      const indicator = document.getElementById('loadingIndicator');
      const sendBtn = document.getElementById('sendBtn');
      if (loading) {
        indicator.classList.add('active');
        sendBtn.setAttribute('disabled', 'true');
      } else {
        indicator.classList.remove('active');
        sendBtn.removeAttribute('disabled');
      }
    }

    function appendMessageElement(role, rawContent, provider, model, latencyMs) {
      const list = document.getElementById('messagesList');
      const row = document.createElement('div');
      row.className = 'message-row ' + role;

      const header = document.createElement('div');
      header.className = 'message-header';
      if (role === 'user') {
        header.textContent = 'YOU';
      } else {
        let meta = 'AI ASSISTANT';
        if (provider) meta += ' (' + provider + ')';
        if (model) meta += ' • ' + model;
        if (latencyMs) meta += ' • ' + latencyMs + 'ms';
        header.textContent = meta;
      }

      const body = document.createElement('div');
      body.className = 'message-body';
      body.innerHTML = formatMarkdown(rawContent);

      row.appendChild(header);
      row.appendChild(body);
      list.appendChild(row);
      scrollToBottom();
    }

    function formatMarkdown(text) {
      if (!text) return '';

      // 1. Escape HTML
      let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // 2. Format fenced code blocks
      const tripleTickRegex = new RegExp('\\x60\\x60\\x60([a-zA-Z0-9_-]*)\\n([\\s\\S]*?)\\x60\\x60\\x60', 'g');
      escaped = escaped.replace(tripleTickRegex, function(m, lang, code) {
        return '<pre><code class="language-' + lang + '">' + code.trim() + '</code></pre>';
      });

      // 3. Format inline code
      const singleTickRegex = new RegExp('\\x60([^\\x60]+)\\x60', 'g');
      escaped = escaped.replace(singleTickRegex, '<code>$1</code>');

      // 4. Transform citations into clickable links: file:line (e.g. src/db.ts:12)
      const citationRegex = /([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+\.[a-zA-Z0-9]+):(\d+)/g;
      escaped = escaped.replace(citationRegex, function(m, file, line) {
        return '<span class="citation-link" data-file="' + file + '" data-line="' + line + '">📄 ' + file + ':' + line + '</span>';
      });

      // 5. Bold **text**
      escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // 6. Convert newlines to paragraphs/lists
      const lines = escaped.split('\\n');
      let html = '';
      let inList = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
          if (!inList) {
            html += '<ul>';
            inList = true;
          }
          html += '<li>' + trimmed.slice(2) + '</li>';
        } else {
          if (inList) {
            html += '</ul>';
            inList = false;
          }
          if (trimmed.length > 0) {
            if (trimmed.startsWith('<pre') || trimmed.endsWith('</pre>')) {
              html += trimmed;
            } else {
              html += '<p>' + trimmed + '</p>';
            }
          }
        }
      }
      if (inList) html += '</ul>';

      return html;
    }

    function scrollToBottom() {
      const chat = document.getElementById('chatContainer');
      chat.scrollTop = chat.scrollHeight;
    }

    document.addEventListener('click', function(e) {
      const target = e.target && e.target.closest ? e.target.closest('.citation-link') : null;
      if (target) {
        const file = target.getAttribute('data-file');
        const line = parseInt(target.getAttribute('data-line') || '1', 10);
        if (file) {
          jumpToCitation(file, line);
        }
      }
    });

    window.addEventListener('message', function(event) {
      const msg = event.data;
      switch (msg.command) {
        case 'assistantResponse':
          setLoadingState(false);
          appendMessageElement('assistant', msg.text, msg.provider, msg.model, msg.latencyMs);
          break;

        case 'assistantError':
          setLoadingState(false);
          appendMessageElement('assistant', '⚠️ **Error**: ' + msg.error);
          break;

        case 'updateStatus':
          const badge = document.getElementById('providerBadge');
          const badgeText = document.getElementById('providerStatusText');
          const modelInfo = document.getElementById('modelInfo');
          badgeText.textContent = msg.status;
          modelInfo.textContent = 'Provider: ' + msg.status;
          badge.className = 'status-badge ' + getBadgeClass(msg.status);
          break;
      }
    });

    function getBadgeClass(status) {
      if (status.includes('Connected')) return 'connected';
      if (status.includes('Offline')) return 'offline';
      if (status.includes('Not configured')) return 'warning';
      if (status.includes('failed') || status.includes('Unavailable')) return 'error';
      return '';
    }

    renderInitialMessages();
  </script>
</body>
</html>`;
}

function getBadgeClass(status: string): string {
  if (status.includes('Connected')) return 'connected';
  if (status.includes('Offline')) return 'offline';
  if (status.includes('Not configured')) return 'warning';
  if (status.includes('failed') || status.includes('Unavailable')) return 'error';
  return '';
}
