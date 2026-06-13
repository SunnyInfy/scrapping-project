import { BaseScraper, ScrapeOptions } from '../BaseScraper';
import { Room, RoomSchema } from '@scrapping/shared';

export class OpenRentScraper extends BaseScraper<Room> {
  constructor() {
    super('OpenRent', 'rooms', 1);
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<Room[]> {
    return this.queue.add(async () => {
      const allResults: Room[] = [];
      const delay = options?.delayMs ?? 2500;
      let skip = 0;
      const pageSize = 12;
      const maxResults = 5000;
      const seenIds = new Set<string>();
      let totalResults = 0;

      try {
        while (allResults.length < maxResults) {
          const pageUrl = new URL(url);
          if (skip > 0) pageUrl.searchParams.set('skip', skip.toString());
          // Remove trailing & if present
          const cleanUrl = pageUrl.toString().replace(/&$/, '');

          // OpenRent may reject non-browser requests, use Playwright mode
          const { page } = await this.fetchPage(cleanUrl, false);
          if (!page) throw new Error('No page returned');

          try {
            // Allow page to render, then dismiss cookie consent wall
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

            // Wait for page content — just check body text length, avoids hardcoded class guessing
            await page.waitForFunction(
              () => (document.body.textContent || '').length > 3000,
              { timeout: 15000 }
            ).catch(() => {});

            // Extract total count
            if (skip === 0) {
              const countText = await page.evaluate(() => document.body?.textContent?.slice(0, 5000) || '');
              const totalMatch = countText.match(/([\d,]+)\s*(?:properties|results|listings)/i);
              if (totalMatch) totalResults = Math.min(parseInt(totalMatch[1].replace(/,/g, ''), 10), maxResults);
            }

            // Extract listings using page.evaluate
            const items: Array<{id: string; href: string; fullText: string}> = await page.evaluate(() => {
              const seen: string[] = [];
              const out: Array<{id: string; href: string; fullText: string}> = [];

              // OpenRent property href patterns
              const linkSelectors = 'a[href*="/property/"], a[href*="/renting/"], .pli-result a, .property-listing a';
              const links = Array.from(document.querySelectorAll(linkSelectors));

              // Fallback: any link with a numeric ID in path that goes to a property
              const allLinks = links.length > 0 ? links : Array.from(document.querySelectorAll('a')).filter(a => {
                const h = (a as HTMLAnchorElement).href;
                return h.includes('openrent.co.uk') && /\/\d+/.test(h) && !h.includes('/search') && !h.includes('/blog');
              });

              for (const link of allLinks) {
                const href = (link as HTMLAnchorElement).href;
                const idMatch = href.match(/\/(\d+)(?:\/|\?|$)/);
                if (!idMatch || seen.includes(idMatch[1])) continue;
                seen.push(idMatch[1]);

                let card: Element = link;
                for (let i = 0; i < 6; i++) {
                  const p = card.parentElement;
                  if (!p || p.tagName === 'BODY') break;
                  card = p;
                  if (['ARTICLE', 'LI', 'SECTION'].includes(card.tagName)) break;
                  // Stop at the first level where the parent has multiple siblings (i >= 0 means stop early)
                  if (card.parentElement && card.parentElement.children.length >= 3 && i >= 0) break;
                }

                out.push({
                  id: idMatch[1],
                  href,
                  fullText: (card.textContent || '').trim().slice(0, 600),
                });
              }
              return out;
            });

            if (items.length === 0) {
              console.log(`[${this.sourceName}] No items at skip=${skip}. Stopping.`);
              break;
            }

            let pageAdded = 0;

            for (const item of items) {
              if (seenIds.has(item.id)) continue;
              seenIds.add(item.id);

              try {
                const text = item.fullText;
                const lower = text.toLowerCase();

                const priceMatch = text.match(/£([\d,]+)\s*(?:pcm|pw|per\s*month|\/mo)?/i);
                let priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
                if (/pw|per\s*week/i.test(text) && priceAmount > 0) {
                  priceAmount = Math.round(priceAmount * 52 / 12);
                }

                const lines = text.split(/\n|  +/).map(s => s.trim()).filter(s => s.length > 6);
                let address = lines.find(l => /[A-Z]{1,2}\d/.test(l) || /street|road|avenue|lane|close/i.test(l))
                  || lines.find(l => l.length > 10 && !/^£/.test(l) && !/^\d+\s*bed/i.test(l))
                  || `OpenRent ${item.id}`;

                const isStudio = /studio/i.test(text);
                let beds = 0;
                const bedMatch = text.match(/(\d+)\s*bed/i);
                if (!isStudio && bedMatch) beds = parseInt(bedMatch[1], 10);

                let bathrooms: number | undefined;
                const bathMatch = text.match(/(\d+)\s*bath/i);
                if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);

                let propertyType: 'flat' | 'house' | 'studio' | 'bungalow' | 'terraced' | 'semi-detached' | undefined;
                if (isStudio) propertyType = 'studio';
                else if (/flat|apartment/i.test(lower)) propertyType = 'flat';
                else if (/semi.?detached/i.test(lower)) propertyType = 'semi-detached';
                else if (/terraced/i.test(lower)) propertyType = 'terraced';
                else if (/bungalow/i.test(lower)) propertyType = 'bungalow';
                else if (/house/i.test(lower)) propertyType = 'house';

                let furnished: 'furnished' | 'unfurnished' | 'part-furnished' | undefined;
                if (/unfurnished/i.test(lower)) furnished = 'unfurnished';
                else if (/part.?furnished/i.test(lower)) furnished = 'part-furnished';
                else if (/furnished/i.test(lower)) furnished = 'furnished';

                let postcode: string | undefined;
                const pcMatch = (address + ' ' + text).match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
                if (pcMatch) postcode = pcMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();

                const rawRoom = {
                  id: `or_${item.id}`,
                  motive: 'rooms',
                  source: this.sourceName,
                  title: address,
                  location: { area: address, ...(postcode && { postcode }) },
                  price: { amount: priceAmount, currency: 'GBP', frequency: 'monthly' },
                  details: {
                    bedrooms: isStudio ? 0 : beds,
                    ...(bathrooms !== undefined && { bathrooms }),
                    ...(propertyType && { propertyType }),
                    ...(furnished && { furnished }),
                  },
                  url: item.href,
                  scraped_at: new Date().toISOString(),
                };

                allResults.push(RoomSchema.parse(rawRoom));
                pageAdded++;
              } catch (err) {
                console.error(`[${this.sourceName}] Skipping ${item.id}:`, err);
              }
            }

            console.log(`[${this.sourceName}] Skip ${skip}: +${pageAdded}. Total: ${allResults.length}`);
            if (options?.onProgress) options.onProgress(allResults.length, totalResults);
            if (pageAdded === 0) break;

            skip += pageSize;
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
