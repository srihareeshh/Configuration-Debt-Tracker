/**
 * Configuration Debt Tracker - Google Gemini AI Provider
 * Connects securely to the Google Gemini API using the official @google/genai SDK.
 * Protects credentials by avoiding URL query-string transmission and redacting sensitive data.
 */

import { GoogleGenAI } from '@google/genai';
import { AIMessage, AIRequestOptions, AIResponse, IAIProvider } from './aiProvider';

export class GeminiAIProvider implements IAIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini API';

  private client: GoogleGenAI | null = null;
  private apiKey: string = '';
  private model: string = 'gemini-2.5-flash';

  constructor(apiKey: string = '', model: string = 'gemini-2.5-flash', injectedClient?: GoogleGenAI) {
    if (injectedClient) {
      this.client = injectedClient;
      this.apiKey = apiKey || 'injected';
      this.model = model || 'gemini-2.5-flash';
    } else {
      this.updateConfig(apiKey, model);
    }
  }

  updateConfig(apiKey: string, model?: string): void {
    this.apiKey = apiKey ? apiKey.trim() : '';
    if (model && model.trim()) {
      this.model = model.trim();
    }
    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    } else {
      this.client = null;
    }
  }

  getModel(): string {
    return this.model;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async isAvailable(): Promise<boolean> {
    return this.hasApiKey();
  }

  /**
   * Dispatches chat request to Gemini with timeout and error classification
   */
  async chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse> {
    const startTime = Date.now();
    if (!this.apiKey || !this.client) {
      throw new Error('Gemini API key is not configured. Run "Configuration Debt: Set Gemini API Key".');
    }

    const systemPrompt = messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    if (conversationMessages.length === 0) {
      throw new Error('No conversational messages provided in request.');
    }

    // Map roles: 'assistant' -> 'model', 'user' -> 'user'
    const contents = conversationMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const timeoutMs = options?.timeoutMs ?? 25000;

    try {
      const apiCall = this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens ?? 2048
        }
      });

      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Gemini request timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      });

      const response = await Promise.race([apiCall, timeoutPromise]).finally(() => {
        clearTimeout(timer);
      });

      const text = response.text?.trim() || '';
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      const latencyMs = Date.now() - startTime;
      const usage = response.usageMetadata;

      return {
        content: text,
        providerId: this.id,
        providerName: this.name,
        modelUsed: this.model,
        latencyMs,
        tokenUsage: usage
          ? {
              promptTokens: usage.promptTokenCount,
              completionTokens: usage.candidatesTokenCount
            }
          : undefined
      };
    } catch (err: unknown) {
      throw this.classifyAndSanitizeError(err);
    }
  }

  /**
   * Sanitizes error message, strictly masking any key occurrence, and provides user-friendly diagnosis.
   */
  public classifyAndSanitizeError(err: unknown): Error {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const lower = rawMsg.toLowerCase();

    // Redact apiKey if present anywhere in the error
    let sanitized = rawMsg;
    if (this.apiKey) {
      sanitized = sanitized.split(this.apiKey).join('<REDACTED>');
    }

    if (
      lower.includes('api_key_invalid') ||
      lower.includes('invalid api key') ||
      lower.includes('api key not valid') ||
      lower.includes('403')
    ) {
      return new Error('Invalid Gemini API key. Provider rejected authentication. Run "Configuration Debt: Set Gemini API Key".');
    }

    if (
      lower.includes('quota') ||
      lower.includes('resource_exhausted') ||
      lower.includes('429')
    ) {
      return new Error('Gemini quota or rate limit reached. Wait before retrying or check your Google AI Studio plan.');
    }

    if (
      lower.includes('model') &&
      (lower.includes('not found') || lower.includes('unsupported') || lower.includes('404'))
    ) {
      return new Error(`Model '${this.model}' is not supported or not found. Select a supported model in Settings.`);
    }

    if (lower.includes('timed out') || lower.includes('timeout')) {
      return new Error('Request timed out. Check your internet connection and retry.');
    }

    if (
      lower.includes('enotfound') ||
      lower.includes('econnrefused') ||
      lower.includes('network') ||
      lower.includes('fetch failed')
    ) {
      return new Error('Network error connecting to Gemini API. Check your internet connection.');
    }

    if (
      lower.includes('503') ||
      lower.includes('unavailable') ||
      lower.includes('high demand')
    ) {
      return new Error('Gemini service is temporarily experiencing high demand. Please try again in a few moments.');
    }

    return new Error(`Gemini request failed: ${sanitized}`);
  }
}
