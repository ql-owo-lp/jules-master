
import { test, expect } from '@playwright/test';

test('should display PR Status Cache Refresh Interval setting', async ({ page }) => {
  await page.goto('/settings');

  // Configuration is merged into General tab, which is default.
  // But explicitly clicking it ensures we are there.
  await page.getByRole('tab', { name: 'General' }).click();

  // Check if the setting input is visible
  const label = page.getByText('PR Status Cache Refresh Interval (seconds)');
  await expect(label).toBeVisible();

  // Check default value
  const input = page.getByLabel('PR Status Cache Refresh Interval (seconds)');
  await expect(input).toHaveValue('60');

  // Update value
  await input.fill('120');

  // Save changes
  // The save button text might be "Save General Settings" or "Save Configuration" depending on which card it is in.
  // In my implementation, I have "Save General Settings" for general card and "Save Configuration" for advanced config card.
  // "PR Status Cache Refresh Interval" is in "Advanced Configuration" card.
  // So the button is "Save Configuration" inside that card? Or did I merge them?
  // Let's check `settings/page.tsx`:
  /*
        <TabsContent value="config" className="space-y-6"> // Wait, I removed this tab content block? No, I merged it.
        Wait, did I remove the `TabsContent value="config"`?
        In my previous overwrite of `settings/page.tsx`:

        {/* General Tab (Merged Configuration) * /}
        <TabsContent value="general" className="space-y-6">
            <Card>... General Settings ...</Card>
            <Card>... Advanced Configuration ...</Card>
            <div className="flex justify-end">
                 <Button onClick={handleSaveSettings}><Save .../> Save General Settings</Button>
            </div>
        </TabsContent>
  */

  // So there is ONE save button at the bottom: "Save General Settings".
  // The test expects "Save Configuration".

  await page.getByRole('button', { name: 'Save General Settings' }).click();

  // Verify toast
  // Use exact match to differentiate from screen reader text which might contain more content
  await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();

  // Reload and verify persistence
  await page.reload();

  await page.getByRole('tab', { name: 'General' }).click();

  await expect(page.getByLabel('PR Status Cache Refresh Interval (seconds)')).toHaveValue('120');
});
