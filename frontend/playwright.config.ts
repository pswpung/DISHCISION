import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:3000',
        headless: true,
        viewport: { width: 430, height: 932 }, // iPhone 14 Pro Max
    },
    webServer: {
        command: 'npx next start -p 3000',
        port: 3000,
        timeout: 60000,
        reuseExistingServer: true,
    },
});
