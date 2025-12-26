import { test, expect } from '@playwright/test';

test('should set security headers', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();

  const headers = response!.headers();

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), browsing-topics=()');
});
