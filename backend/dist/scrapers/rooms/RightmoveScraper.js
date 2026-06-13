import { BaseScraper } from '../BaseScraper';
import { RoomSchema } from '@scrapping/shared';
export class RightmoveScraper extends BaseScraper {
    constructor() {
        // 1 concurrent connection, 'Rightmove' source, 'rooms' motive
        super('Rightmove', 'rooms', 1);
    }
    async scrape(url, options) {
        return this.queue.add(async () => {
            const allResults = [];
            const delay = options?.delayMs || 2000;
            let currentIndex = 0;
            const maxResults = 5000;
            const seenIds = new Set(); // Track seen IDs to detect when we've exhausted results
            try {
                while (allResults.length < maxResults) {
                    // Construct paginated URL safely
                    const pageUrl = new URL(url);
                    pageUrl.searchParams.set('index', currentIndex.toString());
                    console.log(`[${this.sourceName}] Navigating to index ${currentIndex}...`);
                    const { $ } = await this.fetchPage(pageUrl.toString(), true);
                    if (!$)
                        throw new Error('Failed to load cheerio document');
                    // Use data-testid selector which is more stable than CSS classes with hash suffixes
                    // This targets each property card container by its test ID
                    const cards = $('[data-testid^="propertyCard-"]').filter((_, el) => {
                        // Exclude virtual rendered cards if any
                        const testid = $(el).attr('data-testid');
                        return !!(testid && /^propertyCard-\d+$/.test(testid));
                    });
                    if (cards.length === 0) {
                        console.log(`[${this.sourceName}] No more cards found at index ${currentIndex}. Stopping.`);
                        break;
                    }
                    let pageAdded = 0;
                    cards.each((_, element) => {
                        try {
                            const card = $(element);
                            // Find property link - try multiple selectors for robustness
                            let linkAttr = card.find('a[class*="propertyCard-link"]').attr('href');
                            if (!linkAttr) {
                                // Fallback: look for any anchor with properties in href
                                linkAttr = card.find('a[href*="/properties/"]').attr('href');
                            }
                            if (!linkAttr)
                                return;
                            // Extract real Property ID from the URL
                            const idMatch = linkAttr.match(/\/properties\/(\d+)/);
                            if (!idMatch)
                                return;
                            const id = idMatch[1];
                            // Skip if we've already seen this property
                            if (seenIds.has(id))
                                return;
                            seenIds.add(id);
                            // Location/Title - try multiple selectors
                            let address = card.find('address').text().trim();
                            if (!address) {
                                // Fallback: look for title in data or heading elements
                                address = card.find('[class*="PropertyCardTitle"], h2, h3').text().trim();
                            }
                            if (!address)
                                return;
                            // Price parsing - try multiple selectors
                            let rawPrice = card.find('[class*="PropertyPrice_price"]').text().trim();
                            if (!rawPrice) {
                                // Fallback: look for price-related text
                                rawPrice = card.text().match(/£[\d,]+\s*(?:pcm|pw|pa)/i)?.[0] || '';
                            }
                            const priceMatch = rawPrice.match(/£([0-9,]+)\s*(?:pcm|pw|pa)/i);
                            const priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
                            // Bed parsing - improved with more patterns
                            let beds = 0;
                            const rawText = card.text();
                            if (!rawText.toLowerCase().includes('studio')) {
                                // Look for bedroom counts
                                const bedMatch = rawText.match(/(\d+)\s*(?:bed|bedroom)s?/i);
                                if (bedMatch)
                                    beds = parseInt(bedMatch[1], 10);
                            }
                            else {
                                // Studio is usually 0 beds
                                beds = 0;
                            }
                            // Build the unvalidated object
                            const rawRoom = {
                                id: `rm_${id}`,
                                motive: 'rooms',
                                source: this.sourceName,
                                title: address,
                                location: {
                                    area: address,
                                },
                                price: {
                                    amount: priceAmount,
                                    currency: 'GBP',
                                    frequency: 'monthly',
                                },
                                details: {
                                    bedrooms: beds,
                                },
                                url: `https://www.rightmove.co.uk${linkAttr}`,
                                scraped_at: new Date().toISOString(),
                            };
                            // Validate against the shared schema
                            const validatedRoom = RoomSchema.parse(rawRoom);
                            // Add the property
                            allResults.push(validatedRoom);
                            pageAdded++;
                        }
                        catch (err) {
                            console.error(`[${this.sourceName}] Skipping invalid property card:`, err);
                        }
                    });
                    console.log(`[${this.sourceName}] Scraped ${pageAdded} unique rooms from index ${currentIndex}. Total: ${allResults.length}`);
                    if (options?.onProgress) {
                        options.onProgress(allResults.length);
                    }
                    if (pageAdded === 0) {
                        console.log(`[${this.sourceName}] No new properties on this page. Stopping.`);
                        break;
                    }
                    currentIndex += 24; // Rightmove page size
                    // Respect rate limits before next request
                    await new Promise((res) => setTimeout(res, delay));
                }
                return allResults;
            }
            catch (error) {
                console.error(`[${this.sourceName}] Error scraping ${url}:`, error);
                return allResults;
            }
        });
    }
}
