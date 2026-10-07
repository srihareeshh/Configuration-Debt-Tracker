/**
 * Configuration Debt Tracker - Local AI Provider (Ollama / LM Studio)
 * Connects to local OpenAI-compatible endpoints (e.g. http://localhost:11434/v1).
 * Privacy-first: Zero data leaves the local workstation.
 */

import { AIMessage, AIRequestOptions, AIResponse, IAIProvider } from './aiProvider';

export class LocalAIProvider implements IAIProvider {
  readonly id = 'local';
  readonly name = 'Local LLM (Ollama / LM Studio)';

  constructor(
    private endpoint: string = 'http://localhost:11434/v1',
    private model: string = 'llama3'
  ) {}

  updateConfig(endpoint: string, model: string): void {
    this.endpoint = endpoint || 'http://localhost:11434/v1';
    this.model = model || 'llama3';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const cleanEndpoint = this.endpoint.replace(/\/+$/, '');
      const url = `${cleanEndpoint}/models`;
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 2000);

      const resp = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal
      });
      clearTimeout(timeout);
      return resp.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse> {
    const startTime = Date.now();
    const cleanEndpoint = this.endpoint.replace(/\/+$/, '');
    const url = `${cleanEndpoint}/chat/completions`;

    const ctrl = new AbortController();
    const timeoutMs = options?.timeoutMs || 25000;
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 800
        }),
        signal: ctrl.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`Local model HTTP error: ${resp.status} ${resp.statusText}`);
      }

      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content || 'No response returned from local model.';

      return {
        content,
        providerId: this.id,
        providerName: this.name,
        modelUsed: this.model,
        latencyMs: Date.now() - startTime,
        tokenUsage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens
        }
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Local AI connection failed (${this.endpoint}): ${msg}`);
    }
  }
}
