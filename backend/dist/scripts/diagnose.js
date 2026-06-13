import { chromium } from 'playwright';
import fs from 'fs/promises';
async function diagnose() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    console.log('Navigating to Rightmove results...');
    const response = await page.goto('https://www.rightmove.co.uk/property-to-rent/find.html?searchType=RENT&locationIdentifier=REGION%5E87490&insId=1&radius=0.0&minPrice=&maxPrice=&minBedrooms=&maxBedrooms=&displayPropertyType=&maxDaysSinceAdded=&sortByPriceDescending=&_includeLetAgreed=on&primaryDisplayPropertyType=&secondaryDisplayPropertyType=&oldDisplayPropertyType=&oldPrimaryDisplayPropertyType=&letType=&letFurnishType=&houseFlatShare=', { waitUntil: 'domcontentloaded' });
    console.log('Status code:', response?.status());
    // Wait a bit to let any bot protection load
    await page.waitForTimeout(3000);
    const html = await page.content();
    await fs.writeFile('rightmove_debug.html', html);
    console.log('Saved to rightmove_debug.html');
    await browser.close();
}
diagnose();
