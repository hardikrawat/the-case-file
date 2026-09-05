import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1, // Retry once even locally for flaky tests
    workers: process.env.CI ? 1 : 2,

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
        // Zero x-test-bypass headers - genuine NextAuth session cookies only
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
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
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120000, // 2 minutes to start server
        stdout: 'pipe',
        stderr: 'pipe',
    },
});

