// Bot simulator: seeded games through the real pages against the local
// RTDB emulator. Start the emulator first:
//   npx firebase emulators:start --only database --project bunco-60f5d
// then: npx playwright test -c sim/playwright.config.js
// SIM_SEEDS=1-50 picks the games; SIM_WORKERS sets parallel games;
// SIM_PLAYERS=8 fixes the head count (default: random 3-12);
// SIM_PORT serves this checkout's build on another port.
// A game that breaks a rule also saves every phone's table traffic to
// results/games/seed-N.wire.jsonl.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.SIM_PORT || 4173);

export default defineConfig({
  testDir: '.',
  testMatch: '*.sim.js',
  timeout: 8 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: Number(process.env.SIM_WORKERS || 2),
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results/report.json' }]],
  outputDir: 'results/artifacts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    // A bot tapping a button that never shows up is a stuck phone: fail fast
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  webServer: {
    command: `npm run build && npx astro preview --port ${port}`,
    cwd: '..',
    url: `http://localhost:${port}/game.html`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
