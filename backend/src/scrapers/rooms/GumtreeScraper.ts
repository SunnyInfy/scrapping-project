import { BaseScraper, ScrapeOptions } from '../BaseScraper';
import { Room, RoomSchema } from '@scrapping/shared';

export class GumtreeScraper extends BaseScraper<Room> {
  constructor() {
    super('Gumtree', 'rooms', 1);
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<Room[]> {
    return this.queue.add(async () => {
      const allResults: Room[] = [];
      const delay = options?.delayMs ?? 2500;
      let pageNum = 1;
      const maxResults = 5000;
      const seenIds = new Set<string>();
      let totalResults = 0;

      try {
        while (allResults.length < maxResults) {
          const pageUrl = new URL(url);
          if (pageNum > 1) pageUrl.searchParams.set('page', pageNum.toString());

          const { $ } = await this.fetchPage(pageUrl.toString(), true);
          if (!$) throw new Error('No cheerio document');

          // Total count
          if (pageNum === 1) {
            const countText = $('body').text().slice(0, 3000);
            const totalMatch = countText.match(/([\d,]+)\s*(?:ads?|results?|listings?|properties)/i);
            if (totalMatch) {
              totalResults = Math.min(parseInt(totalMatch[1].replace(/,/g, ''), 10), maxResults);
            }
          }

          // Gumtree property listing links — confirmed pattern: /p/property-to-rent/[slug]/[id]
          const links = $('a[href*="/p/property-to-rent/"]');

          if (links.length === 0) {
            console.log(`[${this.sourceName}] No property links on page ${pageNum}. Stopping.`);
            break;
          }

          let pageAdded = 0;

          links.each((_, linkEl) => {
            try {
              const href = $(linkEl).attr('href') || '';
              if (!href) return;

              // Gumtree URL ends with /[numeric-id] — extract last path segment
              const pathParts = href.replace(/\/$/, '').split('/');
              const lastPart = pathParts[pathParts.length - 1];
              const id = /^\d+$/.test(lastPart) ? lastPart : null;
              if (!id || seenIds.has(id)) return;
              seenIds.add(id);

              // Walk up from link to find the card container
              const card = $(linkEl).closest('article, li, [class*="listing"], [class*="result"]');
              const container = card.length ? card : $(linkEl).parent().parent();
              const cardText = container.text().trim();

              // Title — Gumtree puts it in the link text or h2/h3
              let address = container.find('h2, h3, [class*="title"]').first().text().trim();
              if (!address) address = $(linkEl).text().trim();
              if (!address) address = `Gumtree ${id}`;

              // Price — Gumtree confirmed format: "£1,495pm" (no space before pm)
              // Also handle pcm, pw, /month
              const priceText = container.find('[class*="price"]').text().trim()
                || cardText.match(/£[\d,]+\s*(?:pcm|pw|pm|p\/m|per\s*month)?/i)?.[0]
                || '';
              const priceMatch = priceText.match(/£([\d,]+)\s*(?:pcm|pw|pm|p\/m|per\s*month|\/mo)?/i);
              let priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
              if (/pw|per\s*week/i.test(priceText) && priceAmount > 0) {
                priceAmount = Math.round(priceAmount * 52 / 12);
              }

              const lower = cardText.toLowerCase();

              // Bedrooms — Gumtree often has "2 bed" in the title itself
              const isStudio = /studio/i.test(cardText);
              let beds = 0;
              const bedMatch = address.match(/(\d+)\s*bed/i) || cardText.match(/(\d+)\s*bed/i);
              if (!isStudio && bedMatch) beds = parseInt(bedMatch[1], 10);

              // Bathrooms
              let bathrooms: number | undefined;
              const bathMatch = cardText.match(/(\d+)\s*bath/i);
              if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);

              // Property type
              let propertyType: 'flat' | 'house' | 'studio' | 'bungalow' | 'terraced' | 'semi-detached' | undefined;
              if (isStudio) propertyType = 'studio';
              else if (/flat|apartment/i.test(lower)) propertyType = 'flat';
              else if (/semi.?detached/i.test(lower)) propertyType = 'semi-detached';
              else if (/terraced/i.test(lower)) propertyType = 'terraced';
              else if (/bungalow/i.test(lower)) propertyType = 'bungalow';
              else if (/house/i.test(lower)) propertyType = 'house';

              // Furnished
              let furnished: 'furnished' | 'unfurnished' | 'part-furnished' | undefined;
              if (/unfurnished/i.test(lower)) furnished = 'unfurnished';
              else if (/part.?furnished/i.test(lower)) furnished = 'part-furnished';
              else if (/furnished/i.test(lower)) furnished = 'furnished';

              // Postcode — Gumtree titles often end with "RG1" or full postcode
              let postcode: string | undefined;
              const pcMatch = (address + ' ' + cardText).match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
              if (pcMatch) postcode = pcMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();
              else {
                // District only (e.g. "RG1" at end of title)
                const districtMatch = address.match(/,?\s+([A-Z]{1,2}\d[A-Z\d]?)\s*(?:\(|$)/i);
                if (districtMatch) postcode = districtMatch[1].toUpperCase();
              }

              const rawRoom = {
                id: `gt_${id}`,
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
                url: href.startsWith('http') ? href : `https://www.gumtree.com${href}`,
                scraped_at: new Date().toISOString(),
              };

              allResults.push(RoomSchema.parse(rawRoom));
              pageAdded++;
            } catch (err) {
              console.error(`[${this.sourceName}] Skipping card:`, err);
            }
          });

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
      }
    }) as Promise<Room[]>;
  }
}
