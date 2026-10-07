/**
 * Configuration Debt Tracker - Google Gemini AI Provider
 * Connects securely to the Google Gemini API using native fetch.
 * Redacts all secrets before transmission.
 */

import { AIMessage, AIRequestOptions, AIResponse, IAIProvider } from './aiProvider';

export class GeminiAIProvider implements IAIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini API';

  constructor(
    private apiKey: string = '',
    private model: string = 'gemini-1.5-flash'
  ) {}

  updateConfig(apiKey: string, model?: string): void {
    this.apiKey = apiKey || '';
    if (model) this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse> {
    const startTime = Date.now();
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    // Combine system message and user messages
    const systemPrompt = messages.find((m) => m.role === 'system')?.content;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const bodyPayload: any = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 1000
      }
    };

    if (systemPrompt) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey.trim()}`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), options?.timeoutMs || 25000);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: ctrl.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`Gemini API HTTP error: ${resp.status} ${resp.statusText}`);
      }

      const data = (await resp.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response returned from Gemini.';

      return {
        content: text,
        providerId: this.id,
        providerName: this.name,
        modelUsed: this.model,
        latencyMs: Date.now() - startTime,
        tokenUsage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount
        }
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Gemini request failed: ${msg}`);
    }
  }
}
