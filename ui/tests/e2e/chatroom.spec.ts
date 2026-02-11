import { test, expect } from '@playwright/test';

test.describe('Chatroom E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API key
        await page.addInitScript(() => {
            window.localStorage.setItem('jules-api-key-default', '"test-api-key"');
        });
    });

    test('should create a job with chatroom and send a message', async ({ page }) => {
        const jobName = `Chatroom Test Job ${Date.now()}`;

        // 1. Create Job with Chat
        await page.goto('/');
        await page.getByRole('button', { name: 'Create New Job' }).click();
        
        await page.getByLabel('Job Name (Optional)').fill(jobName);
        await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Test Prompt for Chat');
        await page.getByLabel('Number of sessions').fill('1');

        // Disable Background Job to ensure synchronous creation for test stability
        await page.getByLabel('Background Job').click();

        // Enable Chatroom (ensure it's checked)
        const chatSwitch = page.getByLabel('Enable Chatroom');
        if (await chatSwitch.getAttribute('aria-checked') === 'false') {
            await chatSwitch.click();
        }
        await expect(chatSwitch).toBeChecked();

        // Select Repo/Branch
        const repoCombobox = page.getByRole('combobox').filter({ hasText: /test-owner\/test-repo/ }).first();
        await expect(repoCombobox).toBeEnabled();
        
        await page.getByRole('button', { name: 'Create Job' }).click();

        // 2. Wait for Job to appear in list
        // It should redirect or close dialog and show the job.
        // We target the job item container to scope our subsequent actions
        const jobItem = page.locator('.border.rounded-lg.bg-card').filter({ has: page.locator('p', { hasText: jobName }) });
        await expect(jobItem).toBeVisible();

        // 3. Enter Chatroom
        // The enter chat button is in the job header, visible even when collapsed
        // We use a robust data-testid locator to avoid ambiguity and ensure we target the correct element
        // Using global first() selector and a small wait to handle potential list re-renders/timing issues
        await page.waitForTimeout(1000);
        const enterChatButton = page.getByTestId('enter-chat-button').first();
        await expect(enterChatButton).toBeVisible();
        await enterChatButton.click();

        // 4. Verify Chat Page
        await expect(page).toHaveURL(/\/jobs\/.*\/chat/);
        await expect(page.getByText('Job Chatroom')).toBeVisible();
        await expect(page.getByText('Agent Chat')).toBeVisible();

        // 5. Send Message
        const messageInput = page.getByPlaceholder('Type a message...');
        await messageInput.fill('Hello Agent!');
        await page.getByRole('button', { name: 'Send' }).click();

        // 6. Verify Message appears
        await expect(page.getByText('Hello Agent!')).toBeVisible();
        await expect(page.getByText('User')).toBeVisible(); // Sender name
    });
});
