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
}
