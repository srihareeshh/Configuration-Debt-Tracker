/**
 * Configuration Debt Tracker - Configuration Access Patterns Catalog
 * Multi-language specification of static, indexed, and framework configuration access patterns.
 */

import { ReferenceConfidenceLevel } from '../../models/usage';

export interface AccessPatternDef {
  language: string;
  patternType: 'static_property' | 'index_access' | 'framework_helper' | 'annotation' | 'variable_shell';
  confidenceLevel: ReferenceConfidenceLevel;
  confidence: number;
  buildRegex: (key: string) => RegExp;
  description: string;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const CONFIG_ACCESS_PATTERNS: AccessPatternDef[] = [
  // ---------------- JAVASCRIPT / TYPESCRIPT ----------------
  {
    language: 'javascript',
    patternType: 'static_property',
    confidenceLevel: 1,
    confidence: 99,
    buildRegex: (k) => new RegExp(`(?:process\\.env|import\\.meta\\.env)\\.${escapeRegex(k)}\\b`, 'g'),
    description: 'process.env.KEY or import.meta.env.KEY'
  },
  {
    language: 'javascript',
    patternType: 'index_access',
    confidenceLevel: 2,
    confidence: 98,
    buildRegex: (k) => new RegExp(`(?:process\\.env|import\\.meta\\.env)\\[['"\`]${escapeRegex(k)}['"\`]\\]`, 'g'),
    description: 'process.env["KEY"] or import.meta.env["KEY"]'
  },
  {
    language: 'javascript',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 95,
    buildRegex: (k) => new RegExp(`(?:config\\.get|getConfig|env|getenv)\\(['"\`]${escapeRegex(k)}['"\`]\\)`, 'g'),
    description: 'config.get("KEY") or env("KEY")'
  },

  // ---------------- PYTHON ----------------
  {
    language: 'python',
    patternType: 'index_access',
    confidenceLevel: 2,
    confidence: 98,
    buildRegex: (k) => new RegExp(`(?:os\\.environ)\\[['"]${escapeRegex(k)}['"]\\]`, 'g'),
    description: 'os.environ["KEY"]'
  },
  {
    language: 'python',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 96,
    buildRegex: (k) => new RegExp(`(?:os\\.environ\\.get|os\\.getenv|config|env)\\(['"]${escapeRegex(k)}['"](?:,[^)]*)?\\)`, 'g'),
    description: 'os.getenv("KEY") or os.environ.get("KEY")'
  },
  {
    language: 'python',
    patternType: 'static_property',
    confidenceLevel: 3,
    confidence: 92,
    buildRegex: (k) => new RegExp(`(?:settings|config)\\.${escapeRegex(k)}\\b`, 'g'),
    description: 'settings.KEY'
  },

  // ---------------- JAVA ----------------
  {
    language: 'java',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 97,
    buildRegex: (k) => new RegExp(`System\\.getenv\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'System.getenv("KEY")'
  },
  {
    language: 'java',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 96,
    buildRegex: (k) => new RegExp(`System\\.getProperty\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'System.getProperty("KEY")'
  },
  {
    language: 'java',
    patternType: 'annotation',
    confidenceLevel: 3,
    confidence: 97,
    buildRegex: (k) => new RegExp(`@Value\\(['"]\\$\\{${escapeRegex(k)}(?::[^}]*)?\\}['"]\\)`, 'g'),
    description: '@Value("${KEY}") or @Value("${KEY:default}")'
  },
  {
    language: 'java',
    patternType: 'annotation',
    confidenceLevel: 3,
    confidence: 95,
    buildRegex: (k) => new RegExp(`@ConfigProperty\\(name\\s*=\\s*['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: '@ConfigProperty(name = "KEY")'
  },

  // ---------------- GO ----------------
  {
    language: 'go',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 97,
    buildRegex: (k) => new RegExp(`os\\.(?:Getenv|LookupEnv)\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'os.Getenv("KEY") or os.LookupEnv("KEY")'
  },

  // ---------------- RUST ----------------
  {
    language: 'rust',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 97,
    buildRegex: (k) => new RegExp(`(?:std::env::var|env::var|dotenv::var)\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'std::env::var("KEY")'
  },

  // ---------------- C# ----------------
  {
    language: 'csharp',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 97,
    buildRegex: (k) => new RegExp(`Environment\\.GetEnvironmentVariable\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'Environment.GetEnvironmentVariable("KEY")'
  },
  {
    language: 'csharp',
    patternType: 'index_access',
    confidenceLevel: 2,
    confidence: 96,
    buildRegex: (k) => new RegExp(`(?:configuration|config)\\[['"]${escapeRegex(k)}['"]\\]`, 'g'),
    description: 'configuration["KEY"]'
  },
  {
    language: 'csharp',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 94,
    buildRegex: (k) => new RegExp(`config\\.GetSection\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'config.GetSection("KEY")'
  },

  // ---------------- PHP ----------------
  {
    language: 'php',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 96,
    buildRegex: (k) => new RegExp(`(?:getenv|env|config)\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'getenv("KEY") or env("KEY")'
  },
  {
    language: 'php',
    patternType: 'index_access',
    confidenceLevel: 2,
    confidence: 97,
    buildRegex: (k) => new RegExp(`\\$_(?:ENV|SERVER)\\[['"]${escapeRegex(k)}['"]\\]`, 'g'),
    description: '$_ENV["KEY"] or $_SERVER["KEY"]'
  },

  // ---------------- RUBY ----------------
  {
    language: 'ruby',
    patternType: 'index_access',
    confidenceLevel: 2,
    confidence: 98,
    buildRegex: (k) => new RegExp(`ENV\\[['"]${escapeRegex(k)}['"]\\]`, 'g'),
    description: 'ENV["KEY"]'
  },
  {
    language: 'ruby',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 95,
    buildRegex: (k) => new RegExp(`ENV\\.fetch\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'ENV.fetch("KEY")'
  },

  // ---------------- KOTLIN ----------------
  {
    language: 'kotlin',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 97,
    buildRegex: (k) => new RegExp(`System\\.getenv\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'System.getenv("KEY")'
  },

  // ---------------- C / C++ ----------------
  {
    language: 'c',
    patternType: 'framework_helper',
    confidenceLevel: 3,
    confidence: 97,
    buildRegex: (k) => new RegExp(`getenv\\(['"]${escapeRegex(k)}['"]\\)`, 'g'),
    description: 'getenv("KEY")'
  },

  // ---------------- SHELL / BASH ----------------
  {
    language: 'shell',
    patternType: 'variable_shell',
    confidenceLevel: 2,
    confidence: 95,
    buildRegex: (k) => new RegExp(`\\$\\{?${escapeRegex(k)}\\}?\\b`, 'g'),
    description: '$KEY or ${KEY}'
  },

  // ---------------- POWERSHELL ----------------
  {
    language: 'powershell',
    patternType: 'variable_shell',
    confidenceLevel: 2,
    confidence: 96,
    buildRegex: (k) => new RegExp(`\\$env:${escapeRegex(k)}\\b`, 'gi'),
    description: '$env:KEY'
  }
];
