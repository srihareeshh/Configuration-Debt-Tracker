/**
 * Tests for Source Usage Analyzers:
 * Python (os.environ, os.getenv), JS/TS (process.env), Java (@Value, System.getenv)
 */

import * as assert from 'assert';
import { JavaAnalyzer } from '../../src/analyzers/java/javaAnalyzer';
import { JavascriptAnalyzer } from '../../src/analyzers/javascript/javascriptAnalyzer';
import { PythonAnalyzer } from '../../src/analyzers/python/pythonAnalyzer';
import { ScannedFileInfo } from '../../src/utils/fileUtils';

export async function runAnalyzerTests(): Promise<void> {
  console.log('--- Running Source Usage Analyzer Tests ---');

  // 1. Python os.environ and os.getenv tests
  {
    const analyzer = new PythonAnalyzer();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/app.py',
      relativePath: 'app.py',
      filename: 'app.py',
      extension: '.py',
      mtime: new Date(),
      ageDays: 1
    };
    const content = `
import os

db_url = os.environ["DATABASE_URL"]
timeout = os.getenv("API_TIMEOUT", 30)
# Commented line: os.getenv("IGNORED_KEY")
`;
    const refsDb = analyzer.findReferences('DATABASE_URL', content, fileInfo);
    assert.strictEqual(refsDb.length, 1, 'Should find 1 reference to DATABASE_URL in Python');
    assert.strictEqual(refsDb[0].usageType, 'exact');
    assert.ok(refsDb[0].confidence >= 95, 'Confidence should be >= 95%');

    const refsTimeout = analyzer.findReferences('API_TIMEOUT', content, fileInfo);
    assert.strictEqual(refsTimeout.length, 1, 'Should find 1 reference to API_TIMEOUT in Python');

    const refsIgnored = analyzer.findReferences('IGNORED_KEY', content, fileInfo);
    assert.strictEqual(refsIgnored.length, 0, 'Commented code should be ignored');
    console.log('✓ PythonAnalyzer passed');
  }

  // 2. JavaScript / TypeScript process.env tests
  {
    const analyzer = new JavascriptAnalyzer();
    const tsFileInfo: ScannedFileInfo = {
      absolutePath: '/mock/config.ts',
      relativePath: 'config.ts',
      filename: 'config.ts',
      extension: '.ts',
      mtime: new Date(),
      ageDays: 2
    };
    const content = `
export const config = {
  dbUrl: process.env.DATABASE_URL,
  apiUrl: process.env['API_URL'],
  port: import.meta.env.PORT,
  fallback: "API_TIMEOUT"
};
`;
    const refsDb = analyzer.findReferences('DATABASE_URL', content, tsFileInfo);
    assert.strictEqual(refsDb.length, 1, 'Should find process.env.DATABASE_URL');
    assert.strictEqual(refsDb[0].usageType, 'exact');
    assert.strictEqual(refsDb[0].confidence, 98);

    const refsApi = analyzer.findReferences('API_URL', content, tsFileInfo);
    assert.strictEqual(refsApi.length, 1, 'Should find process.env[\'API_URL\']');

    const refsPort = analyzer.findReferences('PORT', content, tsFileInfo);
    assert.strictEqual(refsPort.length, 1, 'Should find import.meta.env.PORT');

    const refsFallback = analyzer.findReferences('API_TIMEOUT', content, tsFileInfo);
    assert.strictEqual(refsFallback.length, 1, 'Should find literal string match');
    assert.strictEqual(refsFallback[0].usageType, 'dynamic');
    assert.ok(refsFallback[0].confidence < 85, 'Literal string confidence should be moderate');
    console.log('✓ JavascriptAnalyzer passed');
  }

  // 3. Java @Value and System.getenv tests
  {
    const analyzer = new JavaAnalyzer();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/DatabaseConfig.java',
      relativePath: 'DatabaseConfig.java',
      filename: 'DatabaseConfig.java',
      extension: '.java',
      mtime: new Date(),
      ageDays: 10
    };
    const content = `
package com.example;
import org.springframework.beans.factory.annotation.Value;

public class DatabaseConfig {
    @Value("\${database.url}")
    private String databaseUrl;

    public void init() {
        String timeout = System.getenv("API_TIMEOUT");
    }
}
`;
    const refsDb = analyzer.findReferences('database.url', content, fileInfo);
    assert.strictEqual(refsDb.length, 1, 'Should find Spring @Value("${database.url}")');
    assert.strictEqual(refsDb[0].usageType, 'exact');
    assert.strictEqual(refsDb[0].confidence, 99);

    const refsTimeout = analyzer.findReferences('API_TIMEOUT', content, fileInfo);
    assert.strictEqual(refsTimeout.length, 1, 'Should find System.getenv("API_TIMEOUT")');
    console.log('✓ JavaAnalyzer passed');
  }

  // 4. Multi-language AST Engine Tests: Go, Rust, C#, Shell
  {
    const { ParserManager } = await import('../../src/code-intelligence/parser/parserManager');
    const parserManager = new ParserManager();

    // Go Test
    const goInfo: ScannedFileInfo = {
      absolutePath: '/mock/worker.go',
      relativePath: 'worker.go',
      filename: 'worker.go',
      extension: '.go',
      mtime: new Date(),
      ageDays: 1
    };
    const goContent = `package main
import "os"
func run() {
    db := os.Getenv("DATABASE_URL")
}`;
    const goRefs = parserManager.findReferencesForKey('DATABASE_URL', goInfo, goContent);
    assert.strictEqual(goRefs.length, 1, 'Go parser should find os.Getenv("DATABASE_URL")');
    assert.strictEqual(goRefs[0].confidenceLevel, 3);
    console.log('✓ GoAnalyzer passed');

    // Rust Test
    const rustInfo: ScannedFileInfo = {
      absolutePath: '/mock/config.rs',
      relativePath: 'config.rs',
      filename: 'config.rs',
      extension: '.rs',
      mtime: new Date(),
      ageDays: 1
    };
    const rustContent = `fn init() {
    let db = std::env::var("DATABASE_URL").unwrap();
}`;
    const rustRefs = parserManager.findReferencesForKey('DATABASE_URL', rustInfo, rustContent);
    assert.strictEqual(rustRefs.length, 1, 'Rust parser should find std::env::var("DATABASE_URL")');
    console.log('✓ RustAnalyzer passed');

    // C# Test
    const csInfo: ScannedFileInfo = {
      absolutePath: '/mock/Config.cs',
      relativePath: 'Config.cs',
      filename: 'Config.cs',
      extension: '.cs',
      mtime: new Date(),
      ageDays: 1
    };
    const csContent = `var url = Environment.GetEnvironmentVariable("DATABASE_URL");`;
    const csRefs = parserManager.findReferencesForKey('DATABASE_URL', csInfo, csContent);
    assert.strictEqual(csRefs.length, 1, 'C# parser should find GetEnvironmentVariable');
    console.log('✓ CSharpAnalyzer passed');

    // Shell Test
    const shInfo: ScannedFileInfo = {
      absolutePath: '/mock/deploy.sh',
      relativePath: 'deploy.sh',
      filename: 'deploy.sh',
      extension: '.sh',
      mtime: new Date(),
      ageDays: 1
    };
    const shContent = `echo "$DATABASE_URL"`;
    const shRefs = parserManager.findReferencesForKey('DATABASE_URL', shInfo, shContent);
    assert.strictEqual(shRefs.length, 1, 'Shell parser should find $DATABASE_URL');
    console.log('✓ ShellAnalyzer passed');
  }

  // 5. False Positive Suppression Test
  {
    const { ParserManager } = await import('../../src/code-intelligence/parser/parserManager');
    const parserManager = new ParserManager();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/false_positive.ts',
      relativePath: 'false_positive.ts',
      filename: 'false_positive.ts',
      extension: '.ts',
      mtime: new Date(),
      ageDays: 1
    };
    const content = `
// Line comment: process.env.DATABASE_URL
/* Multi-line block comment
   process.env.DATABASE_URL
*/
/**
 * JSDoc comment describing DATABASE_URL
 */
const docString = "The configuration DATABASE_URL is required";
`;
    const refs = parserManager.findReferencesForKey('DATABASE_URL', fileInfo, content);
    assert.strictEqual(refs.length, 0, 'Comments and docstrings must NOT be counted as active usage');
    console.log('✓ False Positive Suppression passed (comments strictly isolated)');
  }

  // 6. Dataflow Propagation (Level 5) and Dynamic Key (Level 6) Tests
  {
    const { ParserManager } = await import('../../src/code-intelligence/parser/parserManager');
    const parserManager = new ParserManager();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/dataflow.ts',
      relativePath: 'dataflow.ts',
      filename: 'dataflow.ts',
      extension: '.ts',
      mtime: new Date(),
      ageDays: 1
    };
    const content = `
const key = "DATABASE_URL";
const db = process.env[key];

const prefix = "DATABASE_";
const dynamicVal = process.env[prefix + "URL"];
`;
    const refs = parserManager.findReferencesForKey('DATABASE_URL', fileInfo, content);
    assert.ok(refs.length >= 1, 'Should identify dataflow propagation or dynamic references');
    assert.ok(refs.some((r) => r.confidenceLevel === 5 || r.confidenceLevel === 6));
    console.log('✓ Dataflow & Dynamic Key resolution passed (Levels 5 & 6)');
  }

  // 7. Canonical Key Normalization Tests
  {
    const { canonicalizeKey, generatePossibleVariants, compareLogicalKeys } = await import('../../src/code-intelligence/references/normalizedKeyResolver');
    assert.strictEqual(canonicalizeKey('DATABASE_URL'), 'database.url');
    assert.strictEqual(canonicalizeKey('database.url'), 'database.url');
    assert.strictEqual(canonicalizeKey('databaseUrl'), 'database.url');
    assert.strictEqual(canonicalizeKey('database-url'), 'database.url');

    const variants = generatePossibleVariants('DATABASE_URL');
    assert.ok(variants.includes('database.url'));
    assert.ok(variants.includes('databaseUrl'));
    assert.ok(variants.includes('database_url'));

    const comparison = compareLogicalKeys('DATABASE_URL', 'database.url');
    assert.strictEqual(comparison.related, true);
    assert.strictEqual(comparison.canonicalIdentity, 'database.url');

    const unrelated = compareLogicalKeys('PORT', 'DATABASE_URL');
    assert.strictEqual(unrelated.related, false);
    console.log('✓ Configuration Canonicalization passed');
  }
}

