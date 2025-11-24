
import asyncio
from playwright.async_api import async_playwright, expect

async def verify_progress_bar():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:3000")

        # Use a more specific locator to avoid strict mode violation
        # Looking for the card title "Jobs & Sessions"
        await expect(page.locator("div.text-2xl.font-semibold").filter(has_text="Jobs & Sessions")).to_be_visible()

        await page.screenshot(path="verification/verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_progress_bar())
