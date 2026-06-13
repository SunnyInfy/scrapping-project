# Knowledge Transfer Document — ScrapeMaster

This document is for developers new to the codebase. It covers architecture decisions, data flow, how the scraping pipeline works end-to-end, and how to extend the system with new scrapers or features.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Data Flow — End to End](#3-data-flow--end-to-end)
4. [Backend Deep Dive](#4-backend-deep-dive)
5. [Scraping Pipeline](#5-scraping-pipeline)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Shared Types](#7-shared-types)
8. [State & Cache Management](#8-state--cache-management)
9. [Adding a New Scraper](#9-adding-a-new-scraper)
10. [Adding a New Frontend Page](#10-adding-a-new-frontend-page)
11. [Known Limitations & Gotchas](#11-known-limitations--gotchas)
12. [Performance Design Decisions](#12-performance-design-decisions)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Browser (User)                  │
│         React SPA on http://localhost:5173        │
└───────────────────┬─────────────────────────────┘
                    │ HTTP (Axios)
                    ▼
┌─────────────────────────────────────────────────┐
│           Express API (localhost:3001)           │
│  • POST /scrape — triggers background scrape     │
│  • GET  /status — returns live progress          │
│  • GET  /results — returns JSON from disk/cache  │
│  • GET  /export — returns CSV download           │
│  • GET  /history — lists scrape files            │
│  • DELETE /history/:file — deletes a file        │
└────────────┬────────────────┬───────────────────┘
             │                │
             ▼                ▼
┌────────────────────┐  ┌─────────────────────────┐
│  Playwright +      │  │  File System            │
│  Cheerio Scraper   │  │  data/{motive}/*.json   │
│  (headless Chrome) │  │                         │
└────────────────────┘  └─────────────────────────┘
```

**Key architectural decisions:**
- The scrape is **fire-and-forget**: the POST endpoint returns immediately and the scrape runs asynchronously in the background
- Progress is tracked in a simple in-memory object (`activeScrapes`) on the backend, polled by the frontend every 2 seconds
- Data is persisted as plain JSON files — no database required
- Types are shared between backend and frontend via a `shared` workspace package

---

## 2. Monorepo Structure

The project uses **npm workspaces**. Three packages share a single `node_modules` at the root:

| Package | Role |
|---------|------|
| `shared` | Zod schemas + TypeScript types. Compiled to `shared/dist/`. Imported by both backend and frontend. |
| `backend` | Express server, Playwright scrapers, storage utilities. Runs with `tsx` in dev. |
| `frontend` | React SPA built with Vite. Imports types from `shared`. |

**Why this structure?**  
The `Room` type must be identical between the scraper (which produces the data) and the frontend table (which displays it). Sharing through a workspace eliminates any drift.

**Important:** When you change `shared/src/`, you must run `npm run build:shared` to recompile before backend or frontend will see the changes.

---

## 3. Data Flow — End to End

### Triggering a Scrape

```
User clicks "Trigger Scrape"
  → frontend calls POST /api/scrape/rooms/rightmove { url }
  → backend:
      1. Calls clearScrapedData('rooms') — deletes old JSON files
      2. Calls clearCacheByPrefix('results_rooms') — invalidates cache
      3. Sets activeScrapes['rooms'] = { status: 'scraping', count: 0, total: 0 }
      4. Responds 200 immediately: { status: 'processing' }
      5. Runs scraper asynchronously (no await on the response)
```

### During Scraping

```
Scraper is running in the background...
  → Every page scraped: calls onProgress(count, total)
  → Backend updates activeScrapes['rooms'].count

Frontend polls GET /api/status/rooms every 2 seconds (only while scraping)
  → Backend returns { status: 'scraping', count: N, total: M }
  → Frontend updates progress bar: (N / M) * 100%
```

### Scrape Completes

```
Scraper finishes
  → backend calls saveScrapedData('rooms', 'rightmove', results)
     saves to: data/rooms/rightmove_{ISO-timestamp}.json
  → sets activeScrapes['rooms'] = { status: 'idle', count: results.length, ... }
  → clears results cache again (so next GET /results reads fresh data)

Frontend notices status changed to 'idle'
  → useEffect triggers queryClient.invalidateQueries(['results', 'rooms'])
  → GET /api/results/rooms is called
  → Backend reads all JSON files from data/rooms/, deduplicates by id, caches result
  → Frontend table re-renders with new data
```

### Filtering

Filtering is **100% client-side**. All data is loaded into the browser once; `useMemo` re-runs the filter function only when `appliedFilters` or `data` changes. No API calls are made when the user changes filters.

---

## 4. Backend Deep Dive

### `server.ts`

The single Express server file. Key things to know:

- `activeScrapes` is a plain JavaScript object (not a database, not Redis). It lives in memory and resets if the server restarts. This is intentional simplicity — if the server restarts mid-scrape, the frontend will stop seeing progress, but the scrape process itself will fail (Playwright connection lost).

- The scrape is kicked off with `async` IIFE inside the route handler — the `res.json(...)` is sent before the scrape completes. The scraper runs independently.

- CORS is open (`cors()`) — restrict this if you ever deploy to production.

### `storage.ts`

All file I/O for scraped data lives here. The data directory is resolved relative to the backend's CWD: `path.resolve(process.cwd(), '../data')`.

`getScrapedData` reads **all** JSON files in the motive directory and merges them. This means if you have two scrape files for `rooms`, both are combined and deduplicated by `id`. In practice the scrape flow calls `clearScrapedData` before each new scrape, so there should only ever be one file at a time.

`deleteScrapedDataFile` uses `path.resolve()` and `startsWith(resolvedDir + path.sep)` to prevent path traversal attacks — never pass user input to file system operations without this check.

### `cache.ts`

A thin wrapper around `node-cache` with a 5-minute TTL. Cache keys follow the pattern `results_{motive}` (e.g., `results_rooms`). The cache is:
- **Populated** on the first `GET /api/results/:motive` call after a scrape
- **Cleared** when a new scrape starts and when it finishes (to ensure fresh data)
- **Cleared** when a history file is deleted

---

## 5. Scraping Pipeline

### BaseScraper

`BaseScraper<T>` is an abstract class that any scraper inherits. It handles:

- **Browser lifecycle:** `init()` launches Chromium headless; `close()` tears it down
- **Page fetching:** `fetchPage(url, useCheerio)` navigates and returns either a Cheerio document (for HTML parsing) or a raw Playwright page (for interactive scraping)
- **Rate limiting:** A `p-queue` with configurable concurrency wraps the main scrape logic. Currently all scrapers use concurrency=1.

To create a scraper, extend `BaseScraper<YourType>` and implement the `scrape(url, options?)` method.

### RightmoveScraper

**How it works:**

1. Constructs a paginated URL by appending `?index=N` (0, 24, 48, …) to the user-supplied URL
2. Fetches each page using Cheerio (static HTML, no JS interaction needed)
3. On the **first page**, tries to parse the total result count from `[data-testid="search-and-result-count"]` — e.g., "1 - 24 of 1,256 properties" → extracts `1256`
4. Finds all property cards using `[data-testid^="propertyCard-"]` — this is a stable selector tied to Rightmove's test IDs (less likely to break than hashed CSS class names)
5. For each card, extracts all fields using regex and text matching on the card's raw text content
6. Validates each property against `RoomSchema` using Zod — invalid properties are logged and skipped
7. Stops when: no new cards are found on a page, the `seenIds` set detects all cards are already seen, or `maxResults` (5000) is reached
8. Waits `delayMs` (default 2000ms) between each page to avoid rate limiting

**Selectors in use:**

| Data | Selector / Method |
|------|-------------------|
| Property cards | `[data-testid^="propertyCard-"]` |
| Property link | `a[class*="propertyCard-link"]` → `href` |
| Property ID | Regex on href: `/properties/(\d+)/` |
| Address | `address` element text |
| Price | `[class*="PropertyPrice_price"]` text, then regex |
| Agent name | `[class*="agent"], [class*="landlord"]` |

**Fragility:** If Rightmove changes their HTML structure or test IDs, the scraper will return 0 results. The selector to check first is `[data-testid^="propertyCard-"]`.

---

## 6. Frontend Deep Dive

### State Management Philosophy

The frontend uses **TanStack Query** for all server state (no Redux, no Context for data). Local UI state (filters, URL input) uses React `useState` with `localStorage` persistence.

```
Server state (TanStack Query)
  ['status', 'rooms']    → polling GET /api/status/rooms (active only during scrape)
  ['results', 'rooms']   → GET /api/results/rooms (cached, invalidated on scrape complete)
  ['history', 'rooms']   → GET /api/history/rooms (fetched when History tab opens)

Local state (useState + localStorage)
  filters         → filter panel inputs (not yet applied)
  appliedFilters  → active filters, triggers useMemo recomputation
  url             → scrape URL input
```

### Why Two Filter States?

`filters` holds what the user is currently editing in the filter panel. `appliedFilters` holds what's actually used to filter the table. The user must click **Apply Filters** to commit changes. This prevents the table from re-filtering on every keystroke, which would be expensive for large datasets.

### DataTable Virtualization

`DataTable.tsx` uses `@tanstack/react-virtual`'s `useVirtualizer`. It:
- Estimates each row at 53px
- Renders only the visible rows + 10 overscan rows above/below the viewport
- Uses a "padding row" technique to maintain correct scroll height without absolute positioning (keeps natural HTML table layout intact, so column widths align)

This means even with 5,000 rows, only ~20 DOM nodes exist at any time.

### Polling Strategy

The status query uses a function-form `refetchInterval`:

```typescript
refetchInterval: (query) => query.state.data?.status === 'scraping' ? 2000 : false
```

This stops all polling when the scraper is idle. Without this, the frontend was making a network request every 2 seconds 24/7.

---

## 7. Shared Types

Defined in `shared/src/schemas/`. All types are inferred from Zod schemas:

```typescript
export type Room = z.infer<typeof RoomSchema>;
```

This means the TypeScript type and the runtime validator are the same thing — you can't have them drift.

The backend uses Zod for parsing scraped data: `RoomSchema.parse(rawRoom)` throws if a field is wrong, which causes the scraper to skip that property card and log the error.

The frontend imports `type Room` from `@scrapping/shared` — only the TypeScript type is used (no runtime validation in the UI).

### Adding Fields to a Schema

1. Add the field to `shared/src/schemas/room.ts`
2. Run `npm run build:shared`
3. Update the scraper in `RightmoveScraper.ts` to populate the field
4. Update the column definition in `RoomsView.tsx` if it should appear in the table
5. Update the `headerMapping` and `columnOrder` in `server.ts` if it should appear in CSV exports
6. Update `FilterPanel.tsx` and the filter logic in `RoomsView.tsx` if it should be filterable

---

## 8. State & Cache Management

### Backend In-Memory State

`activeScrapes` in `server.ts` is a plain object:

```typescript
const activeScrapes: Record<string, { status: string, count: number, total: number }> = {};
```

- `status`: `'idle'` | `'scraping'` | `'error'`
- `count`: number of results scraped so far
- `total`: total results detected from page 1 (0 if not parseable)

This resets on server restart. If the backend crashes mid-scrape, the frontend will keep polling and eventually the status will be stale (stuck at `scraping`). A browser refresh resets the frontend state.

### Node-Cache (Results Cache)

Cache key: `results_{motive}` (e.g., `results_rooms`)

The cache is populated when `GET /api/results/:motive` is first called after a scrape. Subsequent identical requests within 5 minutes are served from memory. It is invalidated:
- When a new scrape starts (`POST /api/scrape`)
- When a scrape completes (to force reading the new file)
- When a history file is deleted (`DELETE /api/history`)

### Frontend Query Cache (TanStack Query)

TanStack Query caches responses in memory keyed by query key. Manual invalidation via `queryClient.invalidateQueries(...)` forces a refetch. The flow is:

```
Scrape mutation onSuccess
  → invalidate ['status', 'rooms']   (force immediate progress check)
  → setQueryData(['results', 'rooms'], [])  (wipe table immediately)

status useEffect sees 'idle'
  → invalidate ['results', 'rooms']  (fetch final data)
```

---

## 9. Adding a New Scraper

Example: adding a Zoopla scraper for rooms.

### Step 1 — Add nothing to shared (Room type already exists)

If it's a new motive (e.g., jobs), add a schema to `shared/src/schemas/job.ts` and export it from `shared/src/index.ts`. Then run `npm run build:shared`.

### Step 2 — Create the scraper

```typescript
// backend/src/scrapers/rooms/ZooplaScraper.ts
import { BaseScraper, ScrapeOptions } from '../BaseScraper';
import { Room, RoomSchema } from '@scrapping/shared';

export class ZooplaScraper extends BaseScraper<Room> {
  constructor() {
    super('Zoopla', 'rooms', 1);
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<Room[]> {
    return this.queue.add(async () => {
      const allResults: Room[] = [];
      // ... your scraping logic
      // Call options?.onProgress(allResults.length, totalResults) after each page
      return allResults;
    }) as Promise<Room[]>;
  }
}
```

### Step 3 — Register in server.ts

Find the scraper instantiation block in `POST /api/scrape/:motive/:source` and add:

```typescript
if (motive === 'rooms' && source === 'zoopla') {
  scraper = new ZooplaScraper();
}
```

### Step 4 — Test it

```bash
cd backend
npm run test:scrape
```

Or trigger from the frontend UI by entering a Zoopla URL.

---

## 10. Adding a New Frontend Page

Example: adding a Jobs page.

### Step 1 — Create the page component

```typescript
// frontend/src/pages/JobsView.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchResults, fetchStatus, triggerScrape } from '../services/api';
import { DataTable } from '../components/DataTable';
// ... define columns, filters, etc. — same pattern as RoomsView.tsx

export function JobsView() {
  // Follow the same pattern as RoomsView:
  // 1. status query with conditional polling
  // 2. results query
  // 3. mutation for triggering scrape
  // 4. useMemo for filtered data
  // 5. useEffect to invalidate results when status becomes idle
}
```

### Step 2 — Add to App.tsx

```typescript
import { JobsView } from './pages/JobsView';

// In the tab type:
type Tab = 'rooms' | 'jobs' | 'deals' | 'history';

// In the nav:
<button className={`nav-btn ${activeTab === 'jobs' ? 'active' : ''}`}
  onClick={() => setActiveTab('jobs')}>
  <Briefcase size={20} />
  <span>Jobs</span>
</button>

// In the main content:
{activeTab === 'jobs' && <JobsView />}
```

### Step 3 — Update API service if needed

The existing `fetchResults`, `fetchStatus`, and `triggerScrape` functions already accept a `motive` parameter — no changes needed unless you need a new endpoint.

---

## 11. Known Limitations & Gotchas

### Scraper Fragility

Rightmove regularly updates their site. If the scraper returns 0 results, check:
- Whether `[data-testid^="propertyCard-"]` still matches property cards (inspect live site)
- Whether `[data-testid="search-and-result-count"]` still contains the total count
- Whether the URL format is still valid (Rightmove may have changed query params)

### No Authentication / Multi-User Support

The backend has no authentication. If two users trigger a scrape simultaneously for the same motive, the second scrape will overwrite `activeScrapes['rooms']` and both will compete to write to disk. The app is designed for single-user local use.

### Memory Growth During Long Scrapes

The scraper accumulates all results in `allResults` in memory before saving. A 5000-item scrape uses roughly 20–50 MB of RAM. This is fine locally but would be a concern in a hosted environment.

### No Error Recovery

If the scraper fails mid-way (network timeout, Rightmove blocks the request), `activeScrapes[motive]` is set to `{ status: 'error' }` and partial results are lost. There is no retry or checkpoint mechanism.

### localhost API URL is hardcoded

`frontend/src/services/api.ts` has `http://localhost:3001` hardcoded. If you deploy the backend elsewhere, this must be changed (or made into an environment variable via `import.meta.env.VITE_API_URL`).

### Postcode Extraction is Best-Effort

The scraper extracts postcodes from the raw address string using a regex. Rightmove address formats vary and not all listings will have a parseable postcode. Expect ~60–80% coverage.

---

## 12. Performance Design Decisions

| Decision | Reason |
|----------|--------|
| Virtual table instead of pagination | Thousands of rows can't be rendered in the DOM; windowing keeps DOM size constant (~20 nodes regardless of data size) |
| Client-side filtering | Avoids a round-trip for every filter change; the dataset fits comfortably in browser memory |
| `useMemo` for filtered data | Without memoization, the filter function ran on every React render — several times per second during polling |
| Conditional polling (`status === 'scraping'`) | Without this, the frontend made a network request every 2 seconds permanently, causing constant re-renders |
| `EMPTY_FILTER` constant as default | Avoids creating a new object literal on every render, which would cause unnecessary state comparisons |
| `clearScrapedData` before each scrape | Ensures the results cache and table never show a mix of old and new scrape data |
| node-cache (5-min TTL) for results | Reading and deduplicating multiple large JSON files from disk on every request was measurably slow; the cache makes subsequent requests instant |
