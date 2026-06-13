import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Papa from 'papaparse';
import { RightmoveScraper } from './scrapers/rooms/RightmoveScraper';
import { saveScrapedData, getScrapedData, clearScrapedData } from './utils/storage';
import { getCache, setCache, clearCacheByPrefix } from './utils/cache';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Global tracking for scraping progress
const activeScrapes: Record<string, { status: string, count: number }> = {};

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Scraping API is running' });
});

// Check status of a scrape
app.get('/api/status/:motive', (req: Request, res: Response) => {
  const { motive } = req.params;
  res.json(activeScrapes[motive] || { status: 'idle', count: 0 });
});

// Trigger a scrape
app.post('/api/scrape/:motive/:source', async (req: Request, res: Response) => {
  const { motive, source } = req.params;
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required in the request body.' });
  }

  try {
    let scraper;

    // Instantiate the correct scraper based on motive and source
    if (motive === 'rooms' && source === 'rightmove') {
      scraper = new RightmoveScraper();
    } else {
      return res.status(400).json({ error: `Scraper for motive '${motive}' and source '${source}' is not yet implemented.` });
    }

    // Wipe old data and clear cache so the new URL replaces everything
    await clearScrapedData(motive as any);
    clearCacheByPrefix(`results_${motive}`);

    activeScrapes[motive] = { status: 'scraping', count: 0 };

    // Acknowledge the request immediately
    res.json({ message: `Scrape started for ${motive} on ${source}`, status: 'processing' });

    // Run the scrape asynchronously
    try {
      await scraper.init();
      const results = await scraper.scrape(url, {
        delayMs: 2000,
        onProgress: (count) => {
          if (activeScrapes[motive]) {
            activeScrapes[motive].count = count;
          }
        }
      });
      await scraper.close();

      if (results.length > 0) {
        await saveScrapedData(motive as any, source, results);
        clearCacheByPrefix(`results_${motive}`);
        console.log(`[API] Scrape finished successfully. Saved ${results.length} items.`);
      } else {
        console.log(`[API] Scrape finished but no results were found.`);
      }
      activeScrapes[motive] = { status: 'idle', count: results.length };
    } catch (error) {
      console.error(`[API] Async Scrape failed for ${motive}/${source}:`, error);
      activeScrapes[motive] = { status: 'error', count: 0 };
    }

  } catch (error) {
    console.error(`[API] Scrape setup failed for ${motive}/${source}:`, error);
    activeScrapes[motive] = { status: 'error', count: 0 };
  }
});

// Fetch scraped results
app.get('/api/results/:motive', async (req: Request, res: Response) => {
  const { motive } = req.params;
  
  if (!['rooms', 'jobs', 'deals'].includes(motive)) {
    return res.status(400).json({ error: 'Invalid motive.' });
  }

  const cacheKey = `results_${motive}`;
  const cachedData = getCache(cacheKey);

  if (cachedData) {
    console.log(`[API] Serving ${motive} results from cache.`);
    return res.json({ data: cachedData, motive, source: 'cache' });
  }

  try {
    console.log(`[API] Reading ${motive} results from disk.`);
    const data = await getScrapedData(motive as any);
    
    // Save to cache for subsequent identical requests
    setCache(cacheKey, data);
    
    res.json({ data, motive, source: 'disk' });
  } catch (error) {
    console.error(`[API] Error reading results for ${motive}:`, error);
    res.status(500).json({ error: 'Failed to retrieve results' });
  }
});

// Header mapping for nice, human-readable column names
const headerMapping: Record<string, string> = {
  'title': 'Property Title',
  'location_area': 'Location',
  'price_amount': 'Price (£/month)',
  'price_frequency': 'Frequency',
  'details_bedrooms': 'Bedrooms',
  'details_bathrooms': 'Bathrooms',
  'details_propertyType': 'Property Type',
  'details_furnished': 'Furnished',
  'details_epcRating': 'EPC Rating',
  'amenities_garden': 'Garden',
  'amenities_parking': 'Parking',
  'amenities_gym': 'Gym',
  'amenities_balcony': 'Balcony',
  'details_leaseType': 'Lease Type',
  'agentName': 'Agent',
  'availableDate': 'Available From',
  'url': 'Link'
};

// Logical column order for export
const columnOrder = [
  'title',
  'location_area',
  'price_amount',
  'price_frequency',
  'details_bedrooms',
  'details_bathrooms',
  'details_propertyType',
  'details_furnished',
  'details_epcRating',
  'amenities_garden',
  'amenities_parking',
  'amenities_gym',
  'amenities_balcony',
  'details_leaseType',
  'agentName',
  'availableDate',
  'url'
];

// Format date from ISO string to DD/MM/YYYY
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

// Convert boolean to "Yes" or "No"
const formatBoolean = (value: boolean | undefined | null): string => {
  return value === true ? 'Yes' : (value === false ? 'No' : '');
};

// Capitalize first letter of enum values
const capitalizeEnum = (value: string | undefined | null): string => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

// Export scraped data to CSV
app.get('/api/export/:motive', async (req: Request, res: Response) => {
  const { motive } = req.params;

  if (!['rooms', 'jobs', 'deals'].includes(motive)) {
    return res.status(400).json({ error: 'Invalid motive.' });
  }

  try {
    // Prefer cache if available to prevent hitting the disk on large exports
    const cacheKey = `results_${motive}`;
    let data = getCache(cacheKey);
    
    if (!data) {
      data = await getScrapedData(motive as any);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'No data found to export.' });
    }

    // Flatten nested objects and format data for CSV output
    const flattenedData = data.map((item: any) => {
      const flat: any = {};
      
      // Extract and format properties in logical order
      flat.title = item.title || '';
      
      if (item.location) {
        flat.location_area = item.location.area || '';
      }
      
      if (item.price) {
        // Format price with £ symbol
        flat.price_amount = item.price.amount ? `£${item.price.amount}` : '';
        flat.price_frequency = capitalizeEnum(item.price.frequency);
      }
      
      if (item.details) {
        // Format bedrooms and bathrooms as numbers
        flat.details_bedrooms = item.details.bedrooms ? String(item.details.bedrooms) : '';
        flat.details_bathrooms = item.details.bathrooms ? String(item.details.bathrooms) : '';
        flat.details_propertyType = capitalizeEnum(item.details.propertyType);
        flat.details_furnished = capitalizeEnum(item.details.furnished);
        flat.details_epcRating = item.details.epcRating || '';
        flat.details_leaseType = capitalizeEnum(item.details.leaseType);
      }
      
      // Convert boolean amenities to "Yes/No"
      if (item.amenities) {
        flat.amenities_garden = formatBoolean(item.amenities.garden);
        flat.amenities_parking = formatBoolean(item.amenities.parking);
        flat.amenities_gym = formatBoolean(item.amenities.gym);
        flat.amenities_balcony = formatBoolean(item.amenities.balcony);
      }
      
      flat.agentName = item.agentName || '';
      
      // Format date from ISO to DD/MM/YYYY
      const dateValue = item.details?.availableDate || item.details?.available_from;
      flat.availableDate = formatDate(dateValue);
      
      flat.url = item.url || '';

      return flat;
    });

    // Reorder columns according to columnOrder
    const orderedData = flattenedData.map((item: any) => {
      const ordered: any = {};
      columnOrder.forEach((col) => {
        if (col in item) {
          ordered[col] = item[col];
        }
      });
      return ordered;
    });

    // Use Papa.unparse with custom header mapping
    const csv = Papa.unparse({
      fields: columnOrder.map((col) => headerMapping[col] || col),
      data: orderedData.map((item: any) => columnOrder.map((col) => item[col] || ''))
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${motive}_export_${Date.now()}.csv`);
    
    res.send(csv);

  } catch (error) {
    console.error(`[API] Error exporting CSV for ${motive}:`, error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});
