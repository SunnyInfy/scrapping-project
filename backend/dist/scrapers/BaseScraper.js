import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
export class BaseScraper {
    browser = null;
    context = null;
    queue;
    sourceName;
    motive;
    constructor(sourceName, motive, concurrency = 1) {
        this.sourceName = sourceName;
        this.motive = motive;
        // Rate limiter queue
        this.queue = new PQueue({ concurrency });
    }
    /**
     * Initialize the headless browser context.
     */
    async init() {
        console.log(`[${this.sourceName}] Initializing browser...`);
        this.browser = await chromium.launch({ headless: true });
        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
    }
    /**
     * Safely navigate to a URL and return a Playwright Page or Cheerio document.
     */
    async fetchPage(url, useCheerio = true) {
        if (!this.context)
            throw new Error('Browser context not initialized. Call init() first.');
        const page = await this.context.newPage();
        console.log(`[${this.sourceName}] Navigating to ${url}...`);
        // Wait until domcontentloaded to speed up scraping
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (useCheerio) {
            const content = await page.content();
            const $ = cheerio.load(content);
            await page.close();
            return { $ };
        }
        return { page };
    }
    /**
     * Clean up browser resources.
     */
    async close() {
        if (this.browser) {
            console.log(`[${this.sourceName}] Closing browser...`);
            await this.browser.close();
            this.browser = null;
            this.context = null;
        }
    }
}
