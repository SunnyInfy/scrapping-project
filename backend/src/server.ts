import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Papa from 'papaparse';
import { RightmoveScraper } from './scrapers/rooms/RightmoveScraper';
import { ZooplaScraper } from './scrapers/rooms/ZooplaScraper';
import { SpareRoomScraper } from './scrapers/rooms/SpareRoomScraper';
import { OpenRentScraper } from './scrapers/rooms/OpenRentScraper';
import { IdealFlatmateScraper } from './scrapers/rooms/IdealFlatmateScraper';
import { GumtreeScraper } from './scrapers/rooms/GumtreeScraper';
import {
  saveScrapedData,
  getScrapedData,
  clearScrapedData,
  getScrapedDataFiles,
  deleteScrapedDataFile,
  saveMetadata,
  getMetadata,
  getScrapedDataByFile,
} from './utils/storage';
import { getCache, setCache, clearCacheByPrefix } from './utils/cache';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const activeScrapes: Record<string, { status: string, count: number, total: number }> = {};

app.use(cors());
app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Scraping API is running' });
});

// Returns metadata about all supported scraper sources
app.get('/api/sources/:motive', (req: Request, res: Response) => {
  const { motive } = req.params;
  if (motive === 'rooms') {
    return res.json([
      { id: 'rightmove',     label: 'Rightmove',     hint: 'Paste a search results URL from rightmove.co.uk',      exampleUrl: 'https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=REGION%5E87490&sortType=2&propertyTypes=&includeLetAgreed=false&mustHave=&dontShow=&furnishTypes=&keywords=' },
      { id: 'zoopla',        label: 'Zoopla',        hint: 'Paste a to-rent search URL from zoopla.co.uk',         exampleUrl: 'https://www.zoopla.co.uk/to-rent/property/london/' },
      { id: 'spareroom',     label: 'SpareRoom',     hint: 'Paste a flatshare search URL from spareroom.co.uk',    exampleUrl: 'https://www.spareroom.co.uk/flatshare/london' },
      { id: 'openrent',      label: 'OpenRent',      hint: 'Paste a property-to-rent URL from openrent.co.uk',     exampleUrl: 'https://www.openrent.co.uk/property-to-rent/?term=london' },
      { id: 'idealflatmate', label: 'IdealFlatmate', hint: 'Paste a rooms-to-rent URL from idealflatmate.co.uk',   exampleUrl: 'https://www.idealflatmate.co.uk/rooms-to-rent/london' },
      { id: 'gumtree',       label: 'Gumtree',       hint: 'Paste a property-to-rent search URL from gumtree.com', exampleUrl: 'https://www.gumtree.com/flats-houses/uk' },
    ]);
  }
  return res.status(400).json({ error: 'No sources available for this motive.' });
});

app.get('/api/status/:motive', (req: Request, res: Response) => {
  const { motive } = req.params;
  res.json(activeScrapes[motive] || { status: 'idle', count: 0 });
});

app.post('/api/scrape/:motive/:source', async (req: Request, res: Response) => {
  const { motive, source } = req.params;
  const { url, force } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required in the request body.' });
  }

  // Guard: if same URL was already scraped and force is not set, return 409
  if (!force) {
    const meta = await getMetadata(motive as any);
    if (meta && meta.url === url) {
      return res.status(409).json({
        alreadyScraped: true,
        scrapedAt: meta.scrapedAt,
        count: meta.count,
      });
    }
  }

  try {
    let scraper;

    if (motive === 'rooms' && source === 'rightmove') {
      scraper = new RightmoveScraper();
    } else if (motive === 'rooms' && source === 'zoopla') {
      scraper = new ZooplaScraper();
    } else if (motive === 'rooms' && source === 'spareroom') {
      scraper = new SpareRoomScraper();
    } else if (motive === 'rooms' && source === 'openrent') {
      scraper = new OpenRentScraper();
    } else if (motive === 'rooms' && source === 'idealflatmate') {
      scraper = new IdealFlatmateScraper();
    } else if (motive === 'rooms' && source === 'gumtree') {
      scraper = new GumtreeScraper();
    } else {
      return res.status(400).json({ error: `Scraper for motive '${motive}' and source '${source}' is not yet implemented.` });
    }

    await clearScrapedData(motive as any);
    clearCacheByPrefix(`results_${motive}`);

    activeScrapes[motive] = { status: 'scraping', count: 0, total: 0 };

    res.json({ message: `Scrape started for ${motive} on ${source}`, status: 'processing' });

    try {
      await scraper.init();
      const results = await scraper.scrape(url, {
        delayMs: 2000,
        onProgress: (count, total) => {
          if (activeScrapes[motive]) {
            activeScrapes[motive].count = count;
            if (total > 0) activeScrapes[motive].total = total;
          }
        }
      });
      await scraper.close();

      if (results.length > 0) {
        await saveScrapedData(motive as any, source, results);
        await saveMetadata(motive as any, {
          url,
          scrapedAt: new Date().toISOString(),
          count: results.length,
        });
        clearCacheByPrefix(`results_${motive}`);
        console.log(`[API] Scrape finished successfully. Saved ${results.length} items.`);
      } else {
        console.log(`[API] Scrape finished but no results were found.`);
      }
      activeScrapes[motive] = { status: 'idle', count: results.length, total: activeScrapes[motive]?.total || results.length };
    } catch (error) {
      console.error(`[API] Async Scrape failed for ${motive}/${source}:`, error);
      activeScrapes[motive] = { status: 'error', count: 0, total: 0 };
    }

  } catch (error) {
    console.error(`[API] Scrape setup failed for ${motive}/${source}:`, error);
    activeScrapes[motive] = { status: 'error', count: 0, total: 0 };
  }
});

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
    setCache(cacheKey, data);
    res.json({ data, motive, source: 'disk' });
  } catch (error) {
    console.error(`[API] Error reading results for ${motive}:`, error);
    res.status(500).json({ error: 'Failed to retrieve results' });
  }
});

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

const columnOrder = [
  'title', 'location_area', 'price_amount', 'price_frequency',
  'details_bedrooms', 'details_bathrooms', 'details_propertyType',
  'details_furnished', 'details_epcRating', 'amenities_garden',
  'amenities_parking', 'amenities_gym', 'amenities_balcony',
  'details_leaseType', 'agentName', 'availableDate', 'url'
];

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

const formatBoolean = (value: boolean | undefined | null): string => {
  return value === true ? 'Yes' : (value === false ? 'No' : '');
};

const capitalizeEnum = (value: string | undefined | null): string => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

app.get('/api/export/:motive', async (req: Request, res: Response) => {
  const { motive } = req.params;

  if (!['rooms', 'jobs', 'deals'].includes(motive)) {
    return res.status(400).json({ error: 'Invalid motive.' });
  }

  try {
    const cacheKey = `results_${motive}`;
    let data = getCache(cacheKey);

    if (!data) {
      data = await getScrapedData(motive as any);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'No data found to export.' });
    }

    const flattenedData = data.map((item: any) => {
      const flat: any = {};
      flat.title = item.title || '';
      if (item.location) flat.location_area = item.location.area || '';
      if (item.price) {
        flat.price_amount = item.price.amount ? `£${item.price.amount}` : '';
        flat.price_frequency = capitalizeEnum(item.price.frequency);
      }
      if (item.details) {
        flat.details_bedrooms = item.details.bedrooms ? String(item.details.bedrooms) : '';
        flat.details_bathrooms = item.details.bathrooms ? String(item.details.bathrooms) : '';
        flat.details_propertyType = capitalizeEnum(item.details.propertyType);
        flat.details_furnished = capitalizeEnum(item.details.furnished);
        flat.details_epcRating = item.details.epcRating || '';
        flat.details_leaseType = capitalizeEnum(item.details.leaseType);
      }
      if (item.amenities) {
        flat.amenities_garden = formatBoolean(item.amenities.garden);
        flat.amenities_parking = formatBoolean(item.amenities.parking);
        flat.amenities_gym = formatBoolean(item.amenities.gym);
        flat.amenities_balcony = formatBoolean(item.amenities.balcony);
      }
      flat.agentName = item.agentName || '';
      flat.availableDate = formatDate(item.details?.availableDate || item.details?.available_from);
      flat.url = item.url || '';
      return flat;
    });

    const orderedData = flattenedData.map((item: any) => {
      const ordered: any = {};
      columnOrder.forEach((col) => { if (col in item) ordered[col] = item[col]; });
      return ordered;
    });

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

app.get('/api/history/:motive', async (req: Request, res: Response) => {
  const { motive } = req.params;
  if (!['rooms', 'jobs', 'deals'].includes(motive)) {
    return res.status(400).json({ error: 'Invalid motive.' });
  }
  try {
    const files = await getScrapedDataFiles(motive as any);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

// Must come before DELETE /api/history/:motive/:filename to avoid route collision
app.get('/api/history/:motive/:filename/data', async (req: Request, res: Response) => {
  const { motive, filename } = req.params;
  if (!['rooms', 'jobs', 'deals'].includes(motive)) {
    return res.status(400).json({ error: 'Invalid motive.' });
  }
  if (!/^[a-zA-Z0-9_\-.]+\.json$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }
  try {
    const data = await getScrapedDataByFile(motive as any, filename);
    res.json({ data, motive, source: 'history' });
  } catch (error) {
    console.error(`[API] Error reading history file ${filename}:`, error);
    res.status(500).json({ error: 'Failed to read history file' });
  }
});

app.delete('/api/history/:motive/:filename', async (req: Request, res: Response) => {
  const { motive, filename } = req.params;
  if (!['rooms', 'jobs', 'deals'].includes(motive)) {
    return res.status(400).json({ error: 'Invalid motive.' });
  }
  if (!/^[a-zA-Z0-9_\-.]+\.json$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }
  try {
    await deleteScrapedDataFile(motive as any, filename);
    clearCacheByPrefix(`results_${motive}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});
