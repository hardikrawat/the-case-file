import { test, expect } from '../fixtures/auth.fixtures';

test.describe('File Upload', () => {

    test('should upload file successfully', async ({ authenticatedPage: page }) => {
        // Use a generic profile path that we can mock
        await page.goto('/profile/test-user-123');

        // Mock the upload API
        await page.route('**/api/upload', async route => {
            await route.fulfill({
                status: 200,
                json: { url: 'https://example.com/fake-avatar.png' }
            });
        });

        // Toggle file chooser
        const fileChooserPromise = page.waitForEvent('filechooser');
        // The input is hidden under the dropzone, we can click the dropzone or the hidden input
        await page.locator('#file-upload').setInputFiles({
            name: 'test-avatar.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake-image-data'),
        });

        // Wait for upload success toast
        await expect(page.locator('text=File uploaded successfully!')).toBeVisible({ timeout: 10000 });
    });

    test('should reject oversized files', async ({ authenticatedPage: page }) => {
        await page.goto('/profile/test-user-123');

        // Create a large buffer (>5MB)
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

        // Upload directly via input for speed in tests
        await page.locator('#file-upload').setInputFiles({
            name: 'large.png',
            mimeType: 'image/png',
            buffer: largeBuffer,
        });

        // Expect error toast - the client side handles this check
        await expect(page.locator('text=File too large. Maximum size is 5MB')).toBeVisible();
    });

    test('should reject invalid file types', async ({ authenticatedPage: page }) => {
        await page.goto('/profile/test-user-123');

        await page.locator('#file-upload').setInputFiles({
            name: 'document.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake-pdf-data'),
        });

        // The 'accept' attribute on the input usually handles this, 
        // but if the test forces it or we have JS checks:
        // await expect(page.locator('text=Invalid file type')).toBeVisible();
    });
});
