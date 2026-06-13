import { BaseScraper, ScrapeOptions } from '../BaseScraper';
import { Room, RoomSchema } from '@scrapping/shared';

export class SpareRoomScraper extends BaseScraper<Room> {
  constructor() {
    super('SpareRoom', 'rooms', 1);
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<Room[]> {
    return this.queue.add(async () => {
      const allResults: Room[] = [];
      const delay = options?.delayMs ?? 2000;
      let offset = 0;
      const pageSize = 10;
      const maxResults = 5000;
      const seenIds = new Set<string>();
      let totalResults = 0;

      // Parse search_id from the URL so pagination preserves it
      const baseUrl = new URL(url);
      const searchId = baseUrl.searchParams.get('search_id') || '';

      try {
        while (allResults.length < maxResults) {
          const pageUrl = new URL(url);
          pageUrl.searchParams.set('offset', offset.toString());
          pageUrl.searchParams.set('mode', 'list');
          pageUrl.searchParams.set('sort_by', 'by_day');

          console.log(`[${this.sourceName}] Fetching offset=${offset}...`);
          const { $ } = await this.fetchPage(pageUrl.toString(), true);
          if (!$) throw new Error('No cheerio document');

          // Total count
          if (offset === 0) {
            const countText = $('body').text();
            const totalMatch = countText.match(/of\s+([\d,]+)\s*(?:rooms?|results?|listings?)/i)
              || countText.match(/([\d,]+)\s*(?:rooms?|results?|listings?)\s*found/i)
              || countText.match(/Showing\s+\d+-\d+\s+of\s+([\d,]+)/i);
            if (totalMatch) {
              totalResults = Math.min(parseInt(totalMatch[1].replace(/,/g, ''), 10), maxResults);
            }
          }

          // SpareRoom listings: <li> elements containing links with flatshare_id
          // Confirmed structure from page inspection
          const cards: ReturnType<typeof $>[] = [];
          const cardSet = new Set<unknown>();

          $('a[href*="flatshare_id"]').each((_, linkEl) => {
            const li = $(linkEl).closest('li');
            const domEl = li.get(0);
            if (domEl && !cardSet.has(domEl)) {
              cardSet.add(domEl);
              cards.push(li);
            }
          });

          if (cards.length === 0) {
            console.log(`[${this.sourceName}] No cards at offset ${offset}. Stopping.`);
            break;
          }

          let pageAdded = 0;

          for (const card of cards) {
            try {
              const linkEl = card.find('a[href*="flatshare_id"]').first();
              const href = linkEl.attr('href') || '';

              // ID comes from flatshare_id query param, NOT from URL path
              const idMatch = href.match(/flatshare_id=(\d+)/);
              if (!idMatch) continue;
              const id = idMatch[1];
              if (seenIds.has(id)) continue;
              seenIds.add(id);

              const cardText = card.text();

              // Title — heading link text
              let address = card.find('h2, h3, [class*="heading"], em').first().text().trim();
              if (!address) address = linkEl.text().trim();
              if (!address) return;

              // Location line — SpareRoom shows "Reading (RG1)" pattern
              const locationLine = card.find('[class*="location"], em, span').filter((_, el) => {
                return /\([A-Z]{1,2}\d/.test($(el).text());
              }).first().text().trim();

              let postcode: string | undefined;
              const pcFromLocation = locationLine.match(/\(([A-Z]{1,2}\d[A-Z\d]?(?:\s?\d[A-Z]{2})?)\)/i);
              if (pcFromLocation) {
                postcode = pcFromLocation[1].toUpperCase();
              } else {
                const pcFull = (address + ' ' + cardText).match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
                if (pcFull) postcode = pcFull[1].toUpperCase().replace(/\s+/g, ' ').trim();
              }

              // If address has no street info, append location line
              if (locationLine && !address.includes(locationLine)) {
                address = locationLine ? `${address} - ${locationLine}` : address;
              }

              // Price — SpareRoom uses "£XXX pcm" or "£XXX pw"
              const priceText = card.find('[class*="price"], strong, b').filter((_, el) => /£/.test($(el).text())).first().text().trim()
                || cardText.match(/£[\d,]+\s*(?:pcm|pw|p\/w)/i)?.[0]
                || '';
              const priceMatch = priceText.match(/£([\d,]+)\s*(?:pcm|pw|p\/w)?/i);
              let priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
              // If price looks like a weekly rate (< £500), convert to monthly
              if (/pw|p\/w/i.test(priceText) || (priceAmount > 0 && priceAmount < 500)) {
                priceAmount = Math.round(priceAmount * 52 / 12);
              }

              const lower = cardText.toLowerCase();

              // Bedrooms (SpareRoom often just lists single rooms)
              const isStudio = /studio/i.test(cardText);
              let beds = 1; // default: single room listing
              const bedMatch = cardText.match(/(\d+)\s*(?:bed|bedroom)s?/i);
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
              else furnished = 'furnished'; // SpareRoom rooms are almost always furnished

              const fullUrl = href.startsWith('http') ? href : `https://www.spareroom.co.uk${href}`;

              const rawRoom = {
                id: `sr_${id}`,
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
                url: fullUrl,
                scraped_at: new Date().toISOString(),
              };

              allResults.push(RoomSchema.parse(rawRoom));
              pageAdded++;
            } catch (err) {
              console.error(`[${this.sourceName}] Skipping card:`, err);
            }
          }

          console.log(`[${this.sourceName}] Offset ${offset}: +${pageAdded}. Total: ${allResults.length}`);
          if (options?.onProgress) options.onProgress(allResults.length, totalResults);
          if (pageAdded === 0) break;

          offset += pageSize;
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
