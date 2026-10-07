/**
 * Configuration Debt Tracker - AI Provider Interface & Types
 * Defines the contract for pluggable Local, Gemini, OpenAI-compatible, and Offline AI engines.
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AIResponse {
  content: string;
  providerId: string;
  providerName: string;
  modelUsed: string;
  latencyMs: number;
  tokenUsage?: { promptTokens?: number; completionTokens?: number };
}

export interface IAIProvider {
  readonly id: string;
  readonly name: string;

  isAvailable(): Promise<boolean>;

  chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse>;
}
