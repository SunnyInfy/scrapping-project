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

    // Flatten nested objects (like location.area, price.amount) for CSV output
    const flattenedData = data.map((item: any) => {
      const flat: any = { ...item };
      
      if (item.location) {
        flat.location_area = item.location.area;
        delete flat.location;
      }
      
      if (item.price) {
        flat.price_amount = item.price.amount;
        flat.price_currency = item.price.currency;
        flat.price_frequency = item.price.frequency;
        delete flat.price;
      }
      
      if (item.details) {
        flat.bedrooms = item.details.bedrooms;
        flat.bathrooms = item.details.bathrooms;
        delete flat.details;
      }

      return flat;
    });

    const csv = Papa.unparse(flattenedData);

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
