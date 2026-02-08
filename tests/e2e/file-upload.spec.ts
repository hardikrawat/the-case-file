import { test, expect } from '@playwright/test';

test.describe('File Upload', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'TestPass123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
    });

    test('should upload file successfully', async ({ page }) => {
        await page.goto('/profile/test-user-id');

        // Set up file chooser handler
        const fileChooserPromise = page.waitForEvent('filechooser');

        // Click upload button
        await page.click('input[type="file"]');

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
            name: 'test-avatar.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake-image-data'),
        });

        // Wait for upload success toast
        await expect(page.locator('text=uploaded successfully')).toBeVisible({ timeout: 10000 });
    });

    test('should reject oversized files', async ({ page }) => {
        await page.goto('/profile/test-user-id');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('input[type="file"]');

        const fileChooser = await fileChooserPromise;

        // Create a large buffer (>5MB)
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

        await fileChooser.setFiles({
            name: 'large.png',
            mimeType: 'image/png',
            buffer: largeBuffer,
        });

        // Expect error toast
        await expect(page.locator('text=too large')).toBeVisible();
    });

    test('should reject invalid file types', async ({ page }) => {
        await page.goto('/profile/test-user-id');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('input[type="file"]');

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
            name: 'document.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake-pdf-data'),
        });

        // Expect error
        await expect(page.locator('text=Invalid file type')).toBeVisible();
    });
});
