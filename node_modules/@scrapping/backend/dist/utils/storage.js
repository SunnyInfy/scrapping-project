import fs from 'fs/promises';
import path from 'path';
const DATA_DIR = path.resolve(process.cwd(), '../data');
/**
 * Ensures a directory exists, creating it if necessary.
 */
export async function ensureDir(dirPath) {
    try {
        await fs.access(dirPath);
    }
    catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}
/**
 * Saves JSON data to the appropriate motive folder.
 */
export async function saveScrapedData(motive, source, data) {
    const motiveDir = path.join(DATA_DIR, motive);
    await ensureDir(motiveDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${source}_${timestamp}.json`;
    const filePath = path.join(motiveDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved ${data.length} records to ${filePath}`);
    return filePath;
}
/**
 * Clears old scraped data to ensure fresh searches don't merge with stale ones.
 */
export async function clearScrapedData(motive) {
    const motiveDir = path.join(DATA_DIR, motive);
    try {
        const files = await fs.readdir(motiveDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                await fs.unlink(path.join(motiveDir, file));
            }
        }
        console.log(`[Storage] Cleared old data for motive: ${motive}`);
    }
    catch (err) {
        // Ignore if directory doesn't exist yet
    }
}
/**
 * Reads and aggregates all scraped data JSON files for a specific motive.
 */
export async function getScrapedData(motive) {
    const motiveDir = path.join(DATA_DIR, motive);
    await ensureDir(motiveDir);
    const files = await fs.readdir(motiveDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    let allData = [];
    for (const file of jsonFiles) {
        const filePath = path.join(motiveDir, file);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                allData = allData.concat(parsed);
            }
        }
        catch (err) {
            console.error(`Failed to read or parse file ${filePath}:`, err);
        }
    }
    // Deduplicate by ID to ensure we don't return the exact same item multiple times
    const uniqueDataMap = new Map();
    allData.forEach(item => {
        if (item && item.id) {
            // Overwrite older identical items with newer ones (assuming later array items are newer or order doesn't strictly matter)
            uniqueDataMap.set(item.id, item);
        }
    });
    return Array.from(uniqueDataMap.values());
}
