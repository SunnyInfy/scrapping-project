import { BaseScraper, ScrapeOptions } from '../BaseScraper';
import { Room, RoomSchema } from '@scrapping/shared';

export class RightmoveScraper extends BaseScraper<Room> {
  constructor() {
    // 1 concurrent connection, 'Rightmove' source, 'rooms' motive
    super('Rightmove', 'rooms', 1);
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<Room[]> {
    return this.queue.add(async () => {
      const allResults: Room[] = [];
      const delay = options?.delayMs || 2000;
      let currentIndex = 0;
      const maxResults = 5000;
      const seenIds = new Set<string>();
      let totalResults = 0;

      try {
        while (allResults.length < maxResults) {
          // Construct paginated URL safely
          const pageUrl = new URL(url);
          pageUrl.searchParams.set('index', currentIndex.toString());

          console.log(`[${this.sourceName}] Navigating to index ${currentIndex}...`);
          const { $ } = await this.fetchPage(pageUrl.toString(), true);
          if (!$) throw new Error('Failed to load cheerio document');

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

          // Parse total result count from first page
          if (currentIndex === 0) {
            const countText = $('[data-testid="search-and-result-count"]').text() ||
                              $('.searchHeader-resultCount').text();
            const totalMatch = countText.match(/of\s+([\d,]+)/i);
            if (totalMatch) {
              totalResults = Math.min(parseInt(totalMatch[1].replace(/,/g, ''), 10), maxResults);
            }
          }

          let pageAdded = 0;

          cards.each((_, element) => {
            try {
              const card = $(element);
              const cardText = card.text();
              
              // Find property link - try multiple selectors for robustness
              let linkAttr = card.find('a[class*="propertyCard-link"]').attr('href');
              if (!linkAttr) {
                // Fallback: look for any anchor with properties in href
                linkAttr = card.find('a[href*="/properties/"]').attr('href');
              }
              if (!linkAttr) return;

              // Extract real Property ID from the URL
              const idMatch = linkAttr.match(/\/properties\/(\d+)/);
              if (!idMatch) return; 
              const id = idMatch[1];

              // Skip if we've already seen this property
              if (seenIds.has(id)) return;
              seenIds.add(id);

              // Location/Title - try multiple selectors
              let address = card.find('address').text().trim();
              if (!address) {
                // Fallback: look for title in data or heading elements
                address = card.find('[class*="PropertyCardTitle"], h2, h3').text().trim();
              }
              if (!address) return;

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
              let isStudio = false;
              if (cardText.toLowerCase().includes('studio')) {
                beds = 0;
                isStudio = true;
              } else {
                // Look for bedroom counts
                const bedMatch = cardText.match(/(\d+)\s*(?:bed|bedroom)s?/i);
                if (bedMatch) beds = parseInt(bedMatch[1], 10);
              }

              // Extract bathrooms
              let bathrooms: number | undefined;
              const bathMatch = cardText.match(/(\d+)\s*(?:bath|bathroom)s?/i);
              if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);

              // Extract property type
              let propertyType: 'flat' | 'house' | 'studio' | 'bungalow' | 'terraced' | 'semi-detached' | undefined;
              const lowerCardText = cardText.toLowerCase();
              if (isStudio) {
                propertyType = 'studio';
              } else if (lowerCardText.includes('flat')) {
                propertyType = 'flat';
              } else if (lowerCardText.includes('bungalow')) {
                propertyType = 'bungalow';
              } else if (lowerCardText.includes('semi-detached') || lowerCardText.includes('semi detached')) {
                propertyType = 'semi-detached';
              } else if (lowerCardText.includes('terraced')) {
                propertyType = 'terraced';
              } else if (lowerCardText.includes('house')) {
                propertyType = 'house';
              }

              // Extract furnished status
              let furnished: 'furnished' | 'unfurnished' | 'part-furnished' | undefined;
              if (lowerCardText.includes('unfurnished')) {
                furnished = 'unfurnished';
              } else if (lowerCardText.includes('part-furnished') || lowerCardText.includes('part furnished')) {
                furnished = 'part-furnished';
              } else if (lowerCardText.includes('furnished')) {
                furnished = 'furnished';
              }

              // Extract EPC rating
              let epcRating: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | undefined;
              const epcMatch = cardText.match(/EPC rating[:\s]*([A-G])/i);
              if (epcMatch) {
                epcRating = epcMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
              }

              // Extract lease type
              let leaseType: 'long-term' | 'short-term' | undefined;
              if (lowerCardText.includes('long-term') || lowerCardText.includes('long term')) {
                leaseType = 'long-term';
              } else if (lowerCardText.includes('short-term') || lowerCardText.includes('short term')) {
                leaseType = 'short-term';
              }

              // Extract amenities
              const amenities = {
                garden: lowerCardText.includes('garden'),
                parking: lowerCardText.includes('parking') || lowerCardText.includes('garage'),
                gym: lowerCardText.includes('gym') || lowerCardText.includes('fitness'),
                balcony: lowerCardText.includes('balcony') || lowerCardText.includes('terrace'),
              };

              // Extract agent name - look for agent info section
              let agentName: string | undefined;
              const agentSection = card.find('[class*="agent"], [class*="landlord"]').text().trim();
              if (agentSection) {
                agentName = agentSection.substring(0, 100); // Limit to 100 chars
              }

              // Extract available date
              let availableDate: string | undefined;
              const dateMatch = cardText.match(/(?:available|from)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
              if (dateMatch) {
                try {
                  // Try to parse and normalize the date to ISO format
                  const dateParts = dateMatch[1].split(/[\/\-]/);
                  if (dateParts.length === 3) {
                    let day = parseInt(dateParts[0], 10);
                    let month = parseInt(dateParts[1], 10);
                    let year = parseInt(dateParts[2], 10);
                    
                    if (dateParts[2].length === 2) year += 2000;
                    
                    if (month > 12) {
                      [day, month] = [month, day]; // Swap if format is DD/MM
                    }
                    
                    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                      availableDate = new Date(year, month - 1, day).toISOString().split('T')[0];
                    }
                  }
                } catch (e) {
                  // Silently skip invalid dates
                }
              }

              // Extract postcode from address — try full postcode first, fall back to district
              let postcode: string | undefined;
              const fullPostcodeMatch = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
              if (fullPostcodeMatch) {
                postcode = fullPostcodeMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();
              } else {
                // District-only fallback: e.g. "E1", "SW3", "EC2A"
                const districtMatch = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*$/i);
                if (districtMatch) {
                  postcode = districtMatch[1].toUpperCase();
                }
              }

              // Build the unvalidated object
              const rawRoom = {
                id: `rm_${id}`,
                motive: 'rooms',
                source: this.sourceName,
                title: address,
                location: {
                  area: address,
                  ...(postcode && { postcode }),
                },
                price: {
                  amount: priceAmount,
                  currency: 'GBP',
                  frequency: 'monthly',
                },
                details: {
                  bedrooms: beds,
                  ...(bathrooms !== undefined && { bathrooms }),
                  ...(propertyType && { propertyType }),
                  ...(furnished && { furnished }),
                  ...(epcRating && { epcRating }),
                  ...(leaseType && { leaseType }),
                  ...(availableDate && { availableDate }),
                },
                ...(Object.values(amenities).some(v => v) && { amenities }),
                ...(agentName && { agentName }),
                url: `https://www.rightmove.co.uk${linkAttr}`,
                scraped_at: new Date().toISOString(),
              };

              // Validate against the shared schema
              const validatedRoom = RoomSchema.parse(rawRoom);
              
              // Add the property
              allResults.push(validatedRoom);
              pageAdded++;
            } catch (err) {
              console.error(`[${this.sourceName}] Skipping invalid property card:`, err);
            }
          });

          console.log(`[${this.sourceName}] Scraped ${pageAdded} unique rooms from index ${currentIndex}. Total: ${allResults.length}`);

          if (options?.onProgress) {
            options.onProgress(allResults.length, totalResults);
          }

          if (pageAdded === 0) {
             console.log(`[${this.sourceName}] No new properties on this page. Stopping.`);
             break;
          }

          currentIndex += 24; // Rightmove page size

          // Respect rate limits before next request
          await new Promise((res) => setTimeout(res, delay));
        }
        
        console.log(`[${this.sourceName}] Scraped ${allResults.length} total rooms.`);
        await this.enrichPostcodes(allResults, 50);
        return allResults;
      } catch (error) {
        console.error(`[${this.sourceName}] Error scraping ${url}:`, error);
        return allResults;
      }
    }) as Promise<Room[]>;
  }

  private async enrichPostcodes(rooms: Room[], maxEnrichments = 50): Promise<void> {
    const missing = rooms.filter(r => !r.location.postcode);
    const limit = Math.min(missing.length, maxEnrichments);

    if (limit === 0) return;
    console.log(`[${this.sourceName}] Enriching postcodes for ${limit} properties via Nominatim...`);

    for (let i = 0; i < limit; i++) {
      const room = missing[i];
      try {
        const encodedAddress = encodeURIComponent(room.location.area);
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&addressdetails=1&countrycodes=gb&limit=1`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'ScrapeMaster/1.0 (personal research project)' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const results = await response.json();
          if (results.length > 0 && results[0].address?.postcode) {
            (room.location as any).postcode = results[0].address.postcode.toUpperCase().replace(/\s+/g, ' ').trim();
          }
        }
      } catch {
        // Silently skip — network errors, aborts, rate limits
      }

      if (i < limit - 1) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    const enriched = rooms.filter(r => r.location.postcode).length;
    console.log(`[${this.sourceName}] Postcodes: ${enriched}/${rooms.length} properties covered.`);
  }
}
