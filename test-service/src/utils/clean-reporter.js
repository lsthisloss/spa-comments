class CleanReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }

  onRunComplete(contexts, results) {
    // Only show final summary without details
    if (results.success) {
      const passedTests = results.numPassedTests;
      const testSuites = results.numPassedTestSuites;
      const time = results.testResults.reduce((total, result) => total + result.perfStats.runtime, 0);
      
      console.log(`\n✅ Тесты пройдены: ${passedTests} из ${passedTests} за ${time}ms\n`);
    } else {
      console.log(`\n❌ Некоторые тесты не прошли\n`);
    }
  }

  onTestResult(test, testResult, aggregatedResult) {
    // Don't show individual test results or console output paths
  }
}

module.exports = CleanReporter;
