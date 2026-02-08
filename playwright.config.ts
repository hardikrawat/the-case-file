import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1, // Retry once even locally for flaky tests
    workers: process.env.CI ? 1 : undefined,

    // Multiple reporters for better visibility
    reporter: process.env.CI
        ? [['html'], ['json', { outputFile: 'test-results/results.json' }], ['list']]
        : [['html'], ['list']],

    // Global timeout settings
    timeout: 30000, // 30 seconds per test
    expect: {
        timeout: 10000 // 10 seconds for assertions
    },

    use: {
        baseURL: 'http://localhost:3000',
        trace: 'retain-on-failure', // Only keep traces on failure
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',

        // Better for debugging
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Additional settings for stability
                viewport: { width: 1280, height: 720 },
            },
        },
        // Optionally add more browsers in CI
        ...(process.env.CI ? [{
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        }] : []),
    ],

    webServer: {
        command: 'npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000, // 2 minutes to start server
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
