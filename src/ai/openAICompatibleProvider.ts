/**
 * Configuration Debt Tracker - OpenAI-Compatible Provider
 * Connects to standard OpenAI-compatible endpoints with Bearer authentication.
 */

import { AIMessage, AIRequestOptions, AIResponse, IAIProvider } from './aiProvider';

export class OpenAICompatibleProvider implements IAIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI-Compatible API';

  constructor(
    private endpoint: string = 'https://api.openai.com/v1',
    private apiKey: string = '',
    private model: string = 'gpt-4o-mini'
  ) {}

  updateConfig(endpoint: string, apiKey: string, model: string): void {
    this.endpoint = endpoint || 'https://api.openai.com/v1';
    this.apiKey = apiKey || '';
    this.model = model || 'gpt-4o-mini';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  async chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse> {
    const startTime = Date.now();
    const cleanEndpoint = this.endpoint.replace(/\/+$/, '');
    const url = `${cleanEndpoint}/chat/completions`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), options?.timeoutMs || 25000);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey.trim()}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 1000
        }),
        signal: ctrl.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`OpenAI-compatible HTTP error: ${resp.status} ${resp.statusText}`);
      }

      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content || 'No response returned from endpoint.';

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
      throw new Error(`OpenAI-compatible request failed: ${msg}`);
    }
  }
}
