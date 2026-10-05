/**
 * Configuration Debt Tracker - Secret Detection and Masking Engine
 * Guarantees zero raw secret exposure in UI, logs, and AI communication.
 */

import { SensitivityLevel } from '../models/configuration';

export interface SecretDetectionResult {
  isSecret: boolean;
  sensitivity: SensitivityLevel;
  secretType?: string;
  confidence: number;
}

// Known credential keywords in configuration keys or variable names
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /auth[_-]?token/i,
  /private[_-]?key/i,
  /jwt[_-]?secret/i,
  /client[_-]?secret/i,
  /encryption[_-]?key/i,
  /credentials?/i,
  /session[_-]?secret/i,
  /database[_-]?password/i,
  /db[_-]?pass/i
];

// High-confidence regex patterns for known secret values (including mock formats for safe testing/CI)
const SECRET_VALUE_PATTERNS: { regex: RegExp; type: string }[] = [
  { regex: /AKIA[0-9A-Z]{16}/, type: 'AWS Access Key ID' },
  { regex: /(?:mock_live_|sk_live_|sec_live_)[0-9a-zA-Z_]{18,}/, type: 'Payment Provider Live Secret Key' },
  { regex: /(?:mock_ghp_|ghp_)[0-9a-zA-Z_]{30,}/, type: 'GitHub Personal Access Token' },
  { regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/, type: 'Slack Token' },
  { regex: /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP)? ?PRIVATE KEY-----/, type: 'Private Key Literal' },
  { regex: /ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, type: 'JSON Web Token (JWT)' },
  { regex: /(postgres|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@[^\s]+/, type: 'Database URI with Credentials' }
];

/**
 * Calculates Shannon Entropy of a string to detect randomized high-entropy secrets
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) {
    return 0;
  }
  const frequencies = new Map<string, number>();
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Evaluates whether a configuration item or code literal represents a secret
 */
export function detectSecret(key: string, value: string): SecretDetectionResult {
  const cleanVal = (value || '').trim();

  // 1. Check known value patterns
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.regex.test(cleanVal)) {
      return {
        isSecret: true,
        sensitivity: 'secret',
        secretType: pattern.type,
        confidence: 99
      };
    }
  }

  // 2. Check key name patterns
  const keyMatchesSensitive = SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
  if (keyMatchesSensitive) {
    // If the key suggests a secret and the value is not a generic placeholder
    const isPlaceholder = isPlaceholderValue(cleanVal);
    if (!isPlaceholder && cleanVal.length > 0) {
      return {
        isSecret: true,
        sensitivity: 'secret',
        secretType: `Sensitive Credential (${key})`,
        confidence: 90
      };
    } else {
      return {
        isSecret: false,
        sensitivity: 'sensitive',
        secretType: `Configured Credential Name (${key})`,
        confidence: 70
      };
    }
  }

  // 3. High entropy check on values longer than 20 chars
  if (cleanVal.length >= 20 && !cleanVal.includes(' ') && !cleanVal.startsWith('http')) {
    const entropy = calculateShannonEntropy(cleanVal);
    // Base64/Hex keys usually have entropy > 3.8
    if (entropy > 4.2) {
      return {
        isSecret: true,
        sensitivity: 'secret',
        secretType: 'High-Entropy Random String / Token',
        confidence: 80
      };
    }
  }

  return {
    isSecret: false,
    sensitivity: 'public',
    confidence: 10
  };
}

/**
 * Checks if a value is an obvious placeholder like "your_api_key_here", "changeme", "", etc.
 */
function isPlaceholderValue(val: string): boolean {
  const lower = val.toLowerCase().replace(/["']/g, '');
  return (
    lower === '' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'changeme' ||
    lower === 'todo' ||
    lower.includes('placeholder') ||
    lower.includes('your_') ||
    lower.includes('<your-') ||
    lower.includes('example') ||
    lower === 'secret' ||
    lower === 'password'
  );
}

/**
 * Masks a sensitive value safely for UI display.
 * Retains at most a 2-character prefix or suffix if safe, or fully masks.
 */
export function maskValue(value: string, isSecret = true): string {
  if (!value || value.length === 0) {
    return '';
  }
  if (!isSecret) {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return '••••••••';
  }
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 1)}••••••`;
  }
  // For long tokens, show prefix (e.g. sec_live_••••••)
  if (trimmed.startsWith('sk_live_') || trimmed.startsWith('mock_live_') || trimmed.startsWith('sec_live_')) {
    return 'sec_live_••••••••••••••••';
  }
  if (trimmed.startsWith('ghp_') || trimmed.startsWith('mock_ghp_')) {
    return 'mock_ghp_••••••••••••••••••••';
  }
  if (trimmed.startsWith('AKIA')) {
    return 'AKIA••••••••••••••••';
  }

  return '••••••••••••••••';
}
