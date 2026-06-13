import { RightmoveScraper } from '../scrapers/rooms/RightmoveScraper';
import { saveScrapedData } from '../utils/storage';
async function main() {
    const scraper = new RightmoveScraper();
    try {
        await scraper.init();
        // Sample Rightmove London to rent URL
        const url = 'https://www.rightmove.co.uk/property-to-rent/London.html';
        console.log(`Starting test scrape for ${scraper.sourceName}...`);
        const results = await scraper.scrape(url);
        if (results.length > 0) {
            await saveScrapedData('rooms', 'rightmove', results);
            console.log('Scrape test successful!');
        }
        else {
            console.log('No results scraped. This could be due to bot protection or empty page.');
            // Even if no results (due to structure changes/bot protection), let's save an empty array 
            // to ensure the storage utility works.
            await saveScrapedData('rooms', 'rightmove', []);
        }
    }
    catch (error) {
        console.error('Test script failed:', error);
    }
    finally {
        await scraper.close();
    }
}
main();
