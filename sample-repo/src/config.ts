/**
 * Core Application Configuration Module
 */

export interface AppConfig {
  databaseUrl: string;
  timeoutMs: number;
}

// Accessing used configuration keys via standard process.env API
export const config: AppConfig = {
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/fallback',
  timeoutMs: parseInt(process.env.API_TIMEOUT || '5000', 10)
};

// Line 16: Hardcoded secret token directly in source code
export const INTERNAL_GITHUB_SYNC_TOKEN = "mock_ghp_1234567890abcdef1234567890abcdef1234";
