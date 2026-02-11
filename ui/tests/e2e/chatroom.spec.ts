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

        // Enable Chatroom
        // Ensure it is unchecked initially (default state)
        const chatSwitch = page.getByLabel('Enable Chatroom');
        await expect(chatSwitch).not.toBeChecked();
        await chatSwitch.click({ force: true });
        await expect(chatSwitch).toBeChecked();

        // Disable Background Job to ensure we wait for creation synchronously
        const backgroundSwitch = page.getByLabel('Background Job');
        // Check current state (default is true)
        if (await backgroundSwitch.isChecked()) {
             await backgroundSwitch.click({ force: true });
        }
        await expect(backgroundSwitch).not.toBeChecked();

        // Select Repo/Branch
        const repoCombobox = page.getByRole('combobox').filter({ hasText: /test-owner\/test-repo/ }).first();
        await expect(repoCombobox).toBeEnabled();
        
        await page.getByRole('button', { name: 'Create Job' }).click();

        // 2. Wait for Job to appear in list
        // Since we disabled background job, the creation might take a moment,
        // but the UI should update and close the dialog (or redirect).
        // The list is on the main page.

        // We use the jobTitle to find the common ancestor row
        const jobTitle = page.locator('p.font-semibold', { hasText: jobName });
        await expect(jobTitle).toBeVisible({ timeout: 15000 }); // Wait for creation

        // 3. Enter Chatroom
        // Find the specific 'Enter Chatroom' button associated with this job row.
        const jobRow = page.locator('.border.rounded-lg.bg-card', { has: jobTitle });
        const enterChatButton = jobRow.getByLabel('Enter Chatroom');

        // Wait for the button to be attached and visible.
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
        // Wait for it to appear in the list
        await expect(page.locator('.rounded-lg', { hasText: 'Hello Agent!' })).toBeVisible();
        await expect(page.getByText('User')).toBeVisible(); // Sender name
    });
});
