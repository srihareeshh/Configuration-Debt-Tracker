/**
 * Configuration Debt Tracker - Secure API Key Storage Service
 * Encapsulates VS Code SecretStorage API. Prevents credentials from being
 * stored in settings, workspace files, webviews, or logs.
 */

import type * as vscode from 'vscode';

export const GEMINI_API_KEY_SECRET_ID = 'configurationDebtTracker.geminiApiKey';

export class SecretStorageService {
  private static instance: SecretStorageService | null = null;
  private secrets: vscode.SecretStorage;

  private constructor(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  public static initialize(secrets: vscode.SecretStorage): SecretStorageService {
    SecretStorageService.instance = new SecretStorageService(secrets);
    return SecretStorageService.instance;
  }

  public static getInstance(): SecretStorageService {
    if (!SecretStorageService.instance) {
      throw new Error('SecretStorageService has not been initialized with ExtensionContext.secrets');
    }
    return SecretStorageService.instance;
  }

  /**
   * Retrieves the stored Gemini API key, or empty string if not configured.
   */
  public async getGeminiApiKey(): Promise<string> {
    try {
      const key = await this.secrets.get(GEMINI_API_KEY_SECRET_ID);
      return key ? key.trim() : '';
    } catch {
      return '';
    }
  }

  /**
   * Securely saves the Gemini API key to encrypted SecretStorage.
   */
  public async setGeminiApiKey(key: string): Promise<void> {
    const trimmed = key ? key.trim() : '';
    if (!trimmed) {
      throw new Error('Gemini API key cannot be empty.');
    }
    await this.secrets.store(GEMINI_API_KEY_SECRET_ID, trimmed);
  }

  /**
   * Securely removes the Gemini API key from SecretStorage.
   */
  public async removeGeminiApiKey(): Promise<void> {
    await this.secrets.delete(GEMINI_API_KEY_SECRET_ID);
  }

  /**
   * Checks whether a Gemini API key is configured.
   */
  public async hasGeminiApiKey(): Promise<boolean> {
    const key = await this.getGeminiApiKey();
    return Boolean(key && key.length > 5);
  }
}
