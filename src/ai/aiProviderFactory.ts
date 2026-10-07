/**
 * Configuration Debt Tracker - AI Provider Factory
 * Dynamically resolves and creates the active AI provider based on workspace settings.
 */

import { IAIProvider } from './aiProvider';
import { GeminiAIProvider } from './geminiProvider';
import { LocalAIProvider } from './localProvider';
import { OfflineAIProvider } from './offlineProvider';
import { OpenAICompatibleProvider } from './openAICompatibleProvider';

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

  resolveProvider(settings: ProviderSettings): IAIProvider {
    const type = settings.providerType || 'offline';

    switch (type) {
      case 'local':
        this.localProvider.updateConfig(
          settings.endpoint || 'http://localhost:11434/v1',
          settings.model || 'llama3'
        );
        return this.localProvider;

      case 'gemini':
        this.geminiProvider.updateConfig(
          settings.geminiApiKey || process.env.GEMINI_API_KEY || '',
          settings.model || 'gemini-1.5-flash'
        );
        return this.geminiProvider;

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

  getOfflineProvider(): OfflineAIProvider {
    return this.offlineProvider;
  }
}
