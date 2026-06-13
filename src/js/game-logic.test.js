import {
  generateGameCode,
  assignRandomSeats,
  calculateNextRoundSeating,
  determineWinner,
  updateStandings,
  buildTableLayout,
} from './game-logic.js';

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  async run() {
    for (const test of this.tests) {
      try {
        await test.fn(this);
        this.results.push({ name: test.name, status: 'PASS', error: null });
      } catch (err) {
        this.results.push({ name: test.name, status: 'FAIL', error: err.message });
      }
    }
    return this.results;
  }
}

export const runner = new TestRunner();
