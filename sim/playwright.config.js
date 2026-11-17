// Bot simulator: seeded games through the real pages against the local
// RTDB emulator. Start the emulator first:
//   npx firebase emulators:start --only database --project bunco-60f5d
// then: npx playwright test -c sim/playwright.config.js
// SIM_SEEDS=1-50 picks the games; SIM_WORKERS sets parallel games.
import { defineConfig, devices } from '@playwright/test';

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
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx astro preview --port 4173',
    cwd: '..',
    url: 'http://localhost:4173/game.html',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
