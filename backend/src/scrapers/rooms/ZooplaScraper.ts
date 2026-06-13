import { BaseScraper, ScrapeOptions } from '../BaseScraper';
import { Room, RoomSchema } from '@scrapping/shared';

export class ZooplaScraper extends BaseScraper<Room> {
  constructor() {
    super('Zoopla', 'rooms', 1);
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<Room[]> {
    return this.queue.add(async () => {
      const allResults: Room[] = [];
      const delay = options?.delayMs ?? 3000;
      let pageNum = 1;
      const maxResults = 5000;
      const seenIds = new Set<string>();
      let totalResults = 0;
      let page: any = null;

      try {
        // Open ONE page and reuse it across all pagination — this keeps cookies/localStorage intact
        const result = await this.fetchPage(url, false);
        page = result.page;
        if (!page) throw new Error('No page returned');

        // Dismiss Zoopla cookie consent (OneTrust) once on initial load
        try {
          await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 6000 });
          await page.click('#onetrust-accept-btn-handler');
          await new Promise(r => setTimeout(r, 1000));
        } catch {}

        while (allResults.length < maxResults) {
          const pageUrl = new URL(url);
          pageUrl.searchParams.set('pn', pageNum.toString());

          // Navigate within the same page for pages 2+ (page 1 is already open)
          if (pageNum > 1) {
            await page.goto(pageUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
          }

          // Wait for Zoopla's React app to finish rendering
          await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

          const foundLinks = await page.waitForFunction(
            () => document.querySelectorAll('a[href*="/to-rent/details/"]').length > 0,
            { timeout: 20000 }
          ).then(() => true).catch(() => false);

          if (!foundLinks) {
            console.log(`[${this.sourceName}] No property links on page ${pageNum} within timeout. Stopping.`);
            break;
          }

          // Extract total count from page title or visible text
          if (pageNum === 1) {
            const countText = await page.evaluate(() => document.title + ' ' + (document.querySelector('h1')?.textContent || ''));
            const totalMatch = countText.match(/([\d,]+)\s*(?:properties|results|homes)/i);
            if (totalMatch) totalResults = Math.min(parseInt(totalMatch[1].replace(/,/g, ''), 10), maxResults);
          }

          // Extract all listing data from rendered DOM
          // Avoid named inner functions — tsx/esbuild wraps them with __name() which is unavailable in browser context
          const items: Array<{id: string; href: string; price: string; address: string; fullText: string}> =
            await page.evaluate(() => {
              const linkEls = Array.from(document.querySelectorAll('a[href*="/to-rent/details/"]'));
              const seenInPage: string[] = [];
              const out: any[] = [];

              for (let li = 0; li < linkEls.length; li++) {
                const href = (linkEls[li] as HTMLAnchorElement).href;
                const idMatch = href.match(/\/details\/(\d+)/);
                if (!idMatch || seenInPage.includes(idMatch[1])) continue;
                seenInPage.push(idMatch[1]);

                let card: Element = linkEls[li];
                for (let i = 0; i < 8; i++) {
                  const p = card.parentElement;
                  if (!p || p.tagName === 'BODY') break;
                  card = p;
                  if (card.tagName === 'ARTICLE' || card.tagName === 'LI') break;
                  if (card.parentElement && card.parentElement.children.length >= 3 && i >= 3) break;
                }

                // Price: prefer elements specifically containing "pcm" to avoid weekly price containers
                let price = '';
                const allTextEls = Array.from(card.querySelectorAll('*'));
                for (let ei = 0; ei < allTextEls.length; ei++) {
                  const t = (allTextEls[ei].textContent || '').trim();
                  if (t && /£[\d,]+\s*pcm/i.test(t) && t.length < 60) { price = t; break; }
                }
                if (!price) {
                  const priceSels = ['[class*="price"]', '[class*="Price"]', '[data-testid*="price"]'];
                  for (let si = 0; si < priceSels.length; si++) {
                    const el = card.querySelector(priceSels[si]);
                    if (el && el.textContent && el.textContent.trim()) { price = el.textContent.trim(); break; }
                  }
                }

                let address = '';
                const addrSels = ['address', '[class*="address"]', '[class*="Address"]', '[data-testid*="address"]'];
                for (let si = 0; si < addrSels.length; si++) {
                  const el = card.querySelector(addrSels[si]);
                  if (el && el.textContent && el.textContent.trim()) { address = el.textContent.trim(); break; }
                }

                out.push({
                  id: idMatch[1],
                  href,
                  price,
                  address,
                  fullText: (card.textContent || '').trim().slice(0, 600),
                });
              }
              return out;
            });

          if (items.length === 0) {
            console.log(`[${this.sourceName}] No items extracted on page ${pageNum}. Stopping.`);
            break;
          }

          let pageAdded = 0;

          for (const item of items) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);

            try {
              const text = item.fullText;
              const lower = text.toLowerCase();

              // Price: prefer PCM match; only convert to monthly if explicitly weekly
              const rawPrice = item.price || text;
              let priceAmount = 0;
              const pcmMatch = rawPrice.match(/£([\d,]+)\s*pcm/i)
                || rawPrice.match(/£([\d,]+)\s*per\s*month/i)
                || rawPrice.match(/£([\d,]+)\s*\/\s*mo/i);
              const pwMatch = rawPrice.match(/£([\d,]+)\s*pw(?!\w)/i)
                || rawPrice.match(/£([\d,]+)\s*per\s*week/i);

              if (pcmMatch) {
                priceAmount = parseInt(pcmMatch[1].replace(/,/g, ''), 10);
              } else if (pwMatch) {
                priceAmount = Math.round(parseInt(pwMatch[1].replace(/,/g, ''), 10) * 52 / 12);
              } else {
                const fallback = rawPrice.match(/£([\d,]+)/);
                if (fallback) priceAmount = parseInt(fallback[1].replace(/,/g, ''), 10);
              }

              // Address
              let address = item.address;
              if (!address || address.length < 5) {
                const lines = text.split(/\n|  +/).map(s => s.trim()).filter(s => s.length > 8);
                address = lines.find(l => /[A-Z]{1,2}\d/.test(l) || /street|road|ave|lane|close|way|drive/i.test(l))
                  || lines.find(l => /reading|berkshire|london|manchester/i.test(l))
                  || lines[0]
                  || `Zoopla ${item.id}`;
              }

              // Bedrooms
              const isStudio = /studio/i.test(text);
              let beds = 0;
              const bedMatch = text.match(/(\d+)\s*bed/i);
              if (!isStudio && bedMatch) beds = parseInt(bedMatch[1], 10);

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

              // Postcode: try full postcode first, then outward code (Zoopla often shows partial)
              let postcode: string | undefined;
              const searchText = address + ' ' + text;
              const fullPcMatch = searchText.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
              if (fullPcMatch) {
                postcode = fullPcMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();
              } else {
                const partialPcMatch = searchText.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/);
                if (partialPcMatch) postcode = partialPcMatch[1].toUpperCase();
              }

              const rawRoom = {
                id: `zp_${item.id}`,
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
                url: item.href,
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

          await new Promise(r => setTimeout(r, delay));
        }

        return allResults;
      } catch (error) {
        console.error(`[${this.sourceName}] Error:`, error);
        return allResults;
      } finally {
        if (page) await page.close();
      }
    }) as Promise<Room[]>;
  }
}
