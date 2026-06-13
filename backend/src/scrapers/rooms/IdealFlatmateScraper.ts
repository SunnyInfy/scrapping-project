import { BaseScraper, ScrapeOptions } from '../BaseScraper';
import { Room, RoomSchema } from '@scrapping/shared';

export class IdealFlatmateScraper extends BaseScraper<Room> {
  constructor() {
    super('IdealFlatmate', 'rooms', 1);
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<Room[]> {
    return this.queue.add(async () => {
      const allResults: Room[] = [];
      const delay = options?.delayMs ?? 3000;
      let pageNum = 1;
      const maxResults = 5000;
      const seenIds = new Set<string>();
      let totalResults = 0;

      try {
        while (allResults.length < maxResults) {
          // IdealFlatmate uses "property-page" param in their search URL
          const pageUrl = new URL(url);
          pageUrl.searchParams.set('property-page', pageNum.toString());

          const { page } = await this.fetchPage(pageUrl.toString(), false);
          if (!page) throw new Error('No page returned');

          try {
            // Allow page to render, then dismiss cookie consent
            await new Promise(r => setTimeout(r, 2000));
            await page.evaluate(() => {
              const els = Array.from(document.querySelectorAll('button, a'));
              for (let i = 0; i < els.length; i++) {
                const t = ((els[i] as HTMLElement).textContent || '').toLowerCase().trim();
                if (t === 'accept' || t === 'accept all' || t.includes('accept cookies') || t === 'agree' || t === 'ok') {
                  (els[i] as HTMLElement).click();
                  break;
                }
              }
            }).catch(() => {});
            await new Promise(r => setTimeout(r, 1500));

            // Wait for React to render — look for any property/room links
            const foundContent = await page.waitForFunction(
              () => {
                // IdealFlatmate room listings
                const patterns = [
                  'a[href*="/rooms-to-rent/"]',
                  'a[href*="/room/"]',
                  'a[href*="/property/"]',
                  '[class*="property"]',
                  '[class*="room"]',
                  '[class*="listing"]',
                ];
                for (const p of patterns) {
                  const els = document.querySelectorAll(p);
                  if (els.length > 2) return true;
                }
                // Check that page body has meaningful content beyond navigation
                return (document.body?.textContent?.length || 0) > 2000;
              },
              { timeout: 20000 }
            ).then(() => true).catch(() => false);

            if (!foundContent) {
              console.log(`[${this.sourceName}] Page ${pageNum} did not load meaningful content.`);
              break;
            }

            // Total count
            if (pageNum === 1) {
              const countText = await page.evaluate(() => document.body?.textContent?.slice(0, 3000) || '');
              const totalMatch = countText.match(/([\d,]+)\s*(?:rooms?|properties|results)/i);
              if (totalMatch) totalResults = Math.min(parseInt(totalMatch[1].replace(/,/g, ''), 10), maxResults);
            }

            // Extract using page.evaluate — runs in browser context
            const items: Array<{id: string; href: string; fullText: string}> = await page.evaluate(() => {
              const seen: string[] = [];
              const out: Array<{id: string; href: string; fullText: string}> = [];

              // CSS selectors match attribute values (relative paths), so we query ALL links
              // and filter using a.href which gives the absolute URL in browser context
              const allAnchors = Array.from(document.querySelectorAll('a[href]'));
              const links: Element[] = [];
              for (let ai = 0; ai < allAnchors.length; ai++) {
                const h = (allAnchors[ai] as HTMLAnchorElement).href;
                if (!h.includes('idealflatmate.co.uk')) continue;
                if (!/\/\d{3,}/.test(h)) continue;
                if (h.includes('/search') || h.includes('/help') || h.includes('/terms') || h.includes('/blog') || h.includes('/contact')) continue;
                links.push(allAnchors[ai]);
              }

              for (let pi = 0; pi < links.length; pi++) {
                const href = (links[pi] as HTMLAnchorElement).href;
                const idMatch = href.match(/\/(\d+)(?:\/|\?|$)/) || href.match(/(\d+)(?:\?|$)/);
                if (!idMatch || seen.includes(idMatch[1])) continue;
                seen.push(idMatch[1]);

                // Walk up DOM to find the property card container
                let card: Element = links[pi];
                for (let i = 0; i < 7; i++) {
                  const p = card.parentElement;
                  if (!p || p.tagName === 'BODY') break;
                  card = p;
                  if (['ARTICLE', 'LI', 'SECTION'].includes(card.tagName)) break;
                  // Stop at first level where siblings exist (i >= 0 = stop as soon as parent has many children)
                  if (card.parentElement && card.parentElement.children.length >= 2 && i >= 0) break;
                }

                out.push({
                  id: idMatch[1],
                  href,
                  fullText: (card.textContent || '').trim().slice(0, 800),
                });
              }
              return out;
            });

            if (items.length === 0) {
              console.log(`[${this.sourceName}] No items on page ${pageNum}. Stopping.`);
              break;
            }

            let pageAdded = 0;

            for (const item of items) {
              if (seenIds.has(item.id)) continue;
              seenIds.add(item.id);

              try {
                const text = item.fullText;
                const lower = text.toLowerCase();

                const priceMatch = text.match(/£([\d,]+)\s*(?:pcm|pw|p\/w|per\s*(?:month|week)|\/mo|\/wk)?/i);
                let priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
                if ((/pw|p\/w|per\s*week/i.test(text) || priceAmount < 500) && priceAmount > 0) {
                  priceAmount = Math.round(priceAmount * 52 / 12);
                }

                const lines = text.split(/\n|  +/).map(s => s.trim()).filter(s => s.length > 6);
                let address = lines.find(l => /[A-Z]{1,2}\d/.test(l) || /street|road|ave|lane|close/i.test(l))
                  || lines.find(l => l.length > 15 && !/^£/.test(l))
                  || `IdealFlatmate ${item.id}`;

                const isStudio = /studio/i.test(text);
                let beds = 1;
                const bedMatch = text.match(/(\d+)\s*bed/i);
                if (bedMatch) beds = parseInt(bedMatch[1], 10);

                let propertyType: 'flat' | 'house' | 'studio' | 'bungalow' | 'terraced' | 'semi-detached' | undefined;
                if (isStudio) propertyType = 'studio';
                else if (/flat|apartment/i.test(lower)) propertyType = 'flat';
                else if (/semi.?detached/i.test(lower)) propertyType = 'semi-detached';
                else if (/terraced/i.test(lower)) propertyType = 'terraced';
                else if (/house/i.test(lower)) propertyType = 'house';

                let furnished: 'furnished' | 'unfurnished' | 'part-furnished' | undefined;
                if (/unfurnished/i.test(lower)) furnished = 'unfurnished';
                else if (/part.?furnished/i.test(lower)) furnished = 'part-furnished';
                else if (/furnished/i.test(lower)) furnished = 'furnished';
                else furnished = 'furnished';

                let postcode: string | undefined;
                const pcMatch = (address + ' ' + text).match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
                if (pcMatch) postcode = pcMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();

                const rawRoom = {
                  id: `if_${item.id}`,
                  motive: 'rooms',
                  source: this.sourceName,
                  title: address,
                  location: { area: address, ...(postcode && { postcode }) },
                  price: { amount: priceAmount, currency: 'GBP', frequency: 'monthly' },
                  details: {
                    bedrooms: isStudio ? 0 : beds,
                    ...(propertyType && { propertyType }),
                    ...(furnished && { furnished }),
                  },
                  url: item.href.startsWith('http') ? item.href : `https://www.idealflatmate.co.uk${item.href}`,
                  scraped_at: new Date().toISOString(),
                };

                allResults.push(RoomSchema.parse(rawRoom));
                pageAdded++;
              } catch (err) {
                console.error(`[${this.sourceName}] Skipping ${item.id}:`, err);
              }
            }

            console.log(`[${this.sourceName}] Page ${pageNum}: +${pageAdded}. Total: ${allResults.length}`);
            if (options?.onProgress) options.onProgress(allResults.length, totalResults);
            if (pageAdded === 0) break;

            pageNum++;
          } finally {
            await page.close();
          }

          await new Promise(r => setTimeout(r, delay));
        }

        return allResults;
      } catch (error) {
        console.error(`[${this.sourceName}] Error:`, error);
        return allResults;
      }
    }) as Promise<Room[]>;
  }
}
