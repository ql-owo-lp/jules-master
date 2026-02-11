import { test, expect } from '@playwright/test';

test.describe('Chatroom E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API key
        await page.addInitScript(() => {
            window.localStorage.setItem('jules-api-key-default', '"test-api-key"');
        });
    });

    test('should create a job with chatroom and send a message', async ({ page }) => {
        // 1. Create Job with Chat
        await page.goto('/');
        await page.getByRole('button', { name: 'Create New Job' }).click();
        
        await page.getByLabel('Job Name (Optional)').fill('Chatroom Test Job');
        await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Test Prompt for Chat');
        await page.getByLabel('Number of sessions').fill('1');

        // Enable Chatroom (click the switch)
        // We need to find the switch. It probably has a label "Enable Chatroom"
        await page.getByLabel('Enable Chatroom').click();

        // Select Repo/Branch (Assuming defaults work or we select them like in job-creation.spec.ts)
        const repoCombobox = page.getByRole('combobox').filter({ hasText: /test-owner\/test-repo/ }).first();
        await expect(repoCombobox).toBeEnabled(); // Wait for data
        // Default selection might be empty if not auto-selected?
        // In job-creation.spec.ts it says "We expect the repo to be auto-selected"
        // Let's assume defaults work for now, or select if needed.
        
        await page.getByRole('button', { name: 'Create Job' }).click();

        // 2. Wait for Job to appear in list
        // It should redirect or close dialog and show the job.
        // We look for 'Chatroom Test Job'
        await expect(page.getByText('Chatroom Test Job')).toBeVisible();

        // 3. Enter Chatroom
        // Find the "Enter Chatroom" button for this job.
        // We added aria-label="Enter Chatroom"
        // Might need to expand the accordion first?
        // Job creation usually expands the new job? Or we might need to find the specific job item.
        // The accordion item value is job.id.
        // Let's try to click the button directly if visible, or click the job header first.
        
        await page.getByText('Chatroom Test Job').click(); // Expand accordion
        
        const enterChatButton = page.getByLabel('Enter Chatroom').first();
        await expect(enterChatButton).toBeVisible();
        await enterChatButton.click();

        // 4. Verify Chat Page
        await expect(page).toHaveURL(/\/jobs\/.*\/chat/);
        await expect(page.getByText('Job Chatroom')).toBeVisible();
        await expect(page.getByText('Agent Chat')).toBeVisible();

        // 5. Send Message
        const messageInput = page.getByPlaceholder('Type a message...');
        await messageInput.fill('Hello Agent!');
        await page.getByRole('button', { name: 'Send' }).click(); // Send icon button usually has type='submit' inside form

        // 6. Verify Message appears
        await expect(page.getByText('Hello Agent!')).toBeVisible();
        await expect(page.getByText('User')).toBeVisible(); // Sender name
    });
});
