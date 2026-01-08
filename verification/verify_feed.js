
import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    // Wait for dev server to be ready
    console.log("Waiting for server...");
    await new Promise(r => setTimeout(r, 5000));

    console.log("Navigating...");
    await page.goto('http://localhost:9002');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    console.log("Taking screenshot...");
    await page.screenshot({ path: 'verification/activity-feed.png', fullPage: true });

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

verify();
