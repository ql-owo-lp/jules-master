
import { test, expect } from '@playwright/test';

test.describe('Session Actions', () => {

    test.beforeEach(async ({ page }) => {
        await page.route('/api/sessions', (route) => {
            route.fulfill({
                status: 200,
                body: JSON.stringify([
                    { id: '1', name: 'Test Session 1', state: 'COMPLETED' },
                    { id: '2', name: 'Test Session 2', state: 'RUNNING' },
                ]),
            });
        });
    });

    test('should open Send Message dialog and Quick Reply popover', async ({ page }) => {
        await page.goto('/');

        // Mock the API response for quick replies
        await page.route('/api/quick-replies', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify([
                    { id: 'reply-1', title: 'Test Reply', prompt: 'This is a test reply.' }
                ])
            });
        });

        const accordionTrigger = page.getByRole('button', { name: /Uncategorized Sessions/ });

        // Wait for trigger to be visible (implies sessions loaded)
        await expect(accordionTrigger).toBeVisible({ timeout: 10000 });

        if (await accordionTrigger.getAttribute('aria-expanded') === 'false') {
            await accordionTrigger.click();
        }

        // Open the "Send Message" dialog
        const messageButton = page.getByRole('button', { name: 'Send Message' }).first();
        await messageButton.click();
        await expect(page.getByRole('dialog', { name: 'Send a Message' })).toBeVisible();

        // Open the quick reply popover
        const quickReplyButton = page.getByRole('button', { name: 'Quick Reply' });
        await quickReplyButton.click();

        // Verify that the quick reply popover is open and contains the mocked reply
        await expect(page.getByRole('button', { name: 'Test Reply' })).toBeVisible();

        // Close the dialog
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByRole('dialog', { name: 'Send a Message' })).not.toBeVisible();
    });
});
