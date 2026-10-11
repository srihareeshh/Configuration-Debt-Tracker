/**
 * Configuration Debt Tracker - AI Provider Factory
 * Dynamically resolves and configures active AI providers (Gemini, Local, Offline, OpenAI-compatible).
 * Manages runtime provider status indicators.
 */

import { IAIProvider } from './aiProvider';
import { GeminiAIProvider } from './geminiProvider';
import { LocalAIProvider } from './localProvider';
import { OfflineAIProvider } from './offlineProvider';
import { OpenAICompatibleProvider } from './openAICompatibleProvider';

export type AIProviderStatus =
  | 'Gemini: Connected'
  | 'Gemini: Not configured'
  | 'Gemini: Testing connection'
  | 'Gemini: Request failed'
  | 'Offline mode'
  | 'Local model: Connected'
  | 'Local model: Unavailable';

export interface ProviderSettings {
  providerType?: 'local' | 'gemini' | 'openai' | 'offline';
  model?: string;
  endpoint?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  timeoutMs?: number;
}

export class AIProviderFactory {
  private localProvider = new LocalAIProvider();
  private geminiProvider = new GeminiAIProvider();
  private openAIProvider = new OpenAICompatibleProvider();
  private offlineProvider = new OfflineAIProvider();
  private lastGeminiStatus: AIProviderStatus | null = null;

  resolveProvider(settings: ProviderSettings): IAIProvider {
    const type = settings.providerType || 'offline';

    switch (type) {
      case 'gemini':
        this.geminiProvider.updateConfig(
          settings.geminiApiKey || process.env.GEMINI_API_KEY || '',
          settings.model || 'gemini-2.5-flash'
        );
        return this.geminiProvider;

      case 'local':
        this.localProvider.updateConfig(
          settings.endpoint || 'http://localhost:11434/v1',
          settings.model || 'llama3'
        );
        return this.localProvider;

      case 'openai':
        this.openAIProvider.updateConfig(
          settings.endpoint || 'https://api.openai.com/v1',
          settings.openaiApiKey || process.env.OPENAI_API_KEY || '',
          settings.model || 'gpt-4o-mini'
        );
        return this.openAIProvider;

      case 'offline':
      default:
        return this.offlineProvider;
    }
  }

  async determineStatus(settings: ProviderSettings): Promise<AIProviderStatus> {
    const type = settings.providerType || 'offline';

    if (type === 'offline') {
      return 'Offline mode';
    }

    if (type === 'gemini') {
      const hasKey = Boolean(settings.geminiApiKey || process.env.GEMINI_API_KEY);
      if (!hasKey) {
        return 'Gemini: Not configured';
      }
      if (this.lastGeminiStatus) {
        return this.lastGeminiStatus;
      }
      return 'Gemini: Connected';
    }

    if (type === 'local') {
      const isAvail = await this.localProvider.isAvailable();
      return isAvail ? 'Local model: Connected' : 'Local model: Unavailable';
    }

    return 'Offline mode';
  }

  getStatus(providerType?: string, apiKey?: string): AIProviderStatus {
    const type = providerType || 'offline';
    if (type === 'offline') {
      return 'Offline mode';
    }
    if (type === 'gemini') {
      const hasKey = Boolean(apiKey || process.env.GEMINI_API_KEY);
      if (!hasKey) {
        return 'Gemini: Not configured';
      }
      if (this.lastGeminiStatus) {
        return this.lastGeminiStatus;
      }
      return 'Gemini: Connected';
    }
    if (type === 'local') {
      return 'Local model: Unavailable';
    }
    return 'Offline mode';
  }

  setGeminiStatus(status: AIProviderStatus): void {
    this.lastGeminiStatus = status;
  }

  getOfflineProvider(): OfflineAIProvider {
    return this.offlineProvider;
  }

  getGeminiProvider(): GeminiAIProvider {
    return this.geminiProvider;
  }
}
