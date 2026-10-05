/**
 * Configuration Debt Tracker - Test Suite Runner
 * Executes all unit and integration tests across parsers, analyzers, detectors, risk, health, and services.
 */

import { runAnalyzerTests } from './analyzers/analyzers.test';
import { runDetectorTests } from './detector/debtDetector.test';
import { runHealthScoreTests } from './health/healthScore.test';
import { runParserTests } from './parsers/parsers.test';
import { runIntegrationTests } from './pipeline/integration.test';
import { runRiskTests } from './risk/riskEngine.test';
import { runServicesTests } from './services/services.test';

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log('============================================================');
  console.log('CONFIGURATION DEBT TRACKER - AUTOMATED TEST SUITE');
  console.log('============================================================\n');

  try {
    await runParserTests();
    console.log('');
    await runAnalyzerTests();
    console.log('');
    await runDetectorTests();
    console.log('');
    await runRiskTests();
    console.log('');
    await runHealthScoreTests();
    console.log('');
    await runServicesTests();
    console.log('');
    await runIntegrationTests();
    console.log('');

    const elapsed = Date.now() - startTime;
    console.log('============================================================');
    console.log(`ALL TEST SUITES PASSED SUCCESSFULLY in ${elapsed}ms!`);
    console.log('============================================================');
    process.exit(0);
  } catch (err: unknown) {
    console.error('\n❌ TEST FAILURE DETECTED:');
    if (err instanceof Error) {
      console.error(err.message);
      console.error(err.stack);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
