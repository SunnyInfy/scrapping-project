import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), '../data');
const META_FILENAME = '.scrape-meta.json';

export interface ScrapeMetadata {
  url: string;
  scrapedAt: string;
  count: number;
}

export async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function saveScrapedData(motive: 'rooms' | 'jobs' | 'deals', source: string, data: any[]) {
  const motiveDir = path.join(DATA_DIR, motive);
  await ensureDir(motiveDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${source}_${timestamp}.json`;
  const filePath = path.join(motiveDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved ${data.length} records to ${filePath}`);

  return filePath;
}

export async function saveMetadata(motive: 'rooms' | 'jobs' | 'deals', meta: ScrapeMetadata): Promise<void> {
  const motiveDir = path.join(DATA_DIR, motive);
  await ensureDir(motiveDir);
  const filePath = path.join(motiveDir, META_FILENAME);
  await fs.writeFile(filePath, JSON.stringify(meta, null, 2), 'utf-8');
}

export async function getMetadata(motive: 'rooms' | 'jobs' | 'deals'): Promise<ScrapeMetadata | null> {
  const filePath = path.join(DATA_DIR, motive, META_FILENAME);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as ScrapeMetadata;
  } catch {
    return null;
  }
}

export async function clearScrapedData(motive: 'rooms' | 'jobs' | 'deals') {
  const motiveDir = path.join(DATA_DIR, motive);
  try {
    const files = await fs.readdir(motiveDir);
    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('.')) {
        await fs.unlink(path.join(motiveDir, file));
      }
    }
    console.log(`[Storage] Cleared old data for motive: ${motive}`);
  } catch (err) {
    // Ignore if directory doesn't exist yet
  }
}

export async function getScrapedDataFiles(motive: 'rooms' | 'jobs' | 'deals') {
  const motiveDir = path.join(DATA_DIR, motive);
  await ensureDir(motiveDir);

  const files = await fs.readdir(motiveDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'));

  const fileInfos = await Promise.all(jsonFiles.map(async (filename) => {
    const filePath = path.join(motiveDir, filename);
    const stat = await fs.stat(filePath);
    let count = 0;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) count = data.length;
    } catch { /* ignore */ }
    const source = filename.split('_')[0];
    return { filename, source, date: stat.mtime.toISOString(), size: stat.size, count };
  }));

  return fileInfos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function deleteScrapedDataFile(motive: 'rooms' | 'jobs' | 'deals', filename: string) {
  const motiveDir = path.join(DATA_DIR, motive);
  const filePath = path.resolve(path.join(motiveDir, filename));
  const resolvedDir = path.resolve(motiveDir);
  if (!filePath.startsWith(resolvedDir + path.sep)) {
    throw new Error('Invalid file path');
  }
  await fs.unlink(filePath);
}

export async function getScrapedData(motive: 'rooms' | 'jobs' | 'deals'): Promise<any[]> {
  const motiveDir = path.join(DATA_DIR, motive);
  await ensureDir(motiveDir);

  const files = await fs.readdir(motiveDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'));

  let allData: any[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(motiveDir, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        allData = allData.concat(parsed);
      }
    } catch (err) {
      console.error(`Failed to read or parse file ${filePath}:`, err);
    }
  }

  const uniqueDataMap = new Map();
  allData.forEach(item => {
    if (item && item.id) {
      uniqueDataMap.set(item.id, item);
    }
  });

  return Array.from(uniqueDataMap.values());
}

export async function getScrapedDataByFile(motive: 'rooms' | 'jobs' | 'deals', filename: string): Promise<any[]> {
  const motiveDir = path.join(DATA_DIR, motive);
  const filePath = path.resolve(path.join(motiveDir, filename));
  const resolvedDir = path.resolve(motiveDir);
  if (!filePath.startsWith(resolvedDir + path.sep)) {
    throw new Error('Invalid file path');
  }
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  if (!Array.isArray(data)) throw new Error('File does not contain an array');
  return data;
}
