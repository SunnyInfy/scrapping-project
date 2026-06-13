# ScrapeMaster

A full-stack web scraping platform for the UK market. Scrape property listings, jobs, and deals from popular sites on demand, filter and explore results in a React UI, and export clean CSV files.

**Current scrapers:** Rightmove (rooms/property rentals)  
**Planned scrapers:** Job boards, deal aggregators

---

## Features

- **On-demand scraping** — Paste any Rightmove search URL and trigger a live scrape
- **Real-time progress** — Progress bar reflects actual total results detected on page 1
- **Virtual table** — Renders thousands of rows at 60 fps using windowing (no pagination lag)
- **Sort & filter** — Sort by title or price; filter by price range, bedrooms, property type, furnished status, lease type, location, and postcode
- **CSV export** — One-click export with formatted, human-readable column headers
- **Scrape history** — View all past scrape sessions, see disk usage, and delete old data
- **Type-safe monorepo** — Shared Zod schemas validate data across backend and frontend

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| State management | TanStack Query v5 |
| Table | TanStack Table v8 + TanStack Virtual v3 |
| Backend | Node.js, Express 4, TypeScript |
| Scraping | Playwright (Chromium headless) + Cheerio |
| Validation | Zod |
| CSV export | PapaParse |
| Caching | node-cache (5-min TTL) |
| Monorepo | npm workspaces |

---

## Project Structure

```
scrapping-project/
├── shared/              # Zod schemas and TypeScript types (consumed by both layers)
│   └── src/schemas/
│       ├── room.ts
│       ├── job.ts
│       └── deal.ts
├── backend/             # Express API + Playwright scrapers
│   └── src/
│       ├── server.ts            # All REST endpoints
│       ├── scrapers/
│       │   ├── BaseScraper.ts   # Abstract browser + queue base class
│       │   └── rooms/
│       │       └── RightmoveScraper.ts
│       └── utils/
│           ├── storage.ts       # File I/O for JSON data
│           └── cache.ts         # In-memory cache helpers
├── frontend/            # React SPA
│   └── src/
│       ├── App.tsx              # Sidebar navigation
│       ├── pages/
│       │   ├── RoomsView.tsx
│       │   └── HistoryView.tsx
│       ├── components/
│       │   ├── DataTable.tsx    # Virtual + sortable table
│       │   ├── FilterPanel.tsx  # Collapsible filters
│       │   ├── ProgressBar.tsx
│       │   └── StatusBadge.tsx
│       └── services/api.ts      # Axios client
└── data/                # Scraped JSON files (git-ignored)
    └── rooms/
```

---

## Quick Start

> Full step-by-step instructions including prerequisites, troubleshooting, and environment setup are in [`docs/SETUP.md`](docs/SETUP.md).

```bash
# 1. Install all dependencies
npm install

# 2. Install Playwright browser (first time only)
cd backend && npx playwright install chromium && cd ..

# 3. Start everything
npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend:** http://localhost:3001  
- **Health check:** http://localhost:3001/api/health

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/status/:motive` | Live scrape progress |
| POST | `/api/scrape/:motive/:source` | Trigger a new scrape |
| GET | `/api/results/:motive` | Fetch scraped data |
| GET | `/api/export/:motive` | Download CSV |
| GET | `/api/history/:motive` | List scrape sessions |
| DELETE | `/api/history/:motive/:filename` | Delete a session |

Full API reference: [`docs/API.md`](docs/API.md)

---

## Documentation

| Document | Description |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Prerequisites, installation, local dev guide, troubleshooting |
| [`docs/KT.md`](docs/KT.md) | Knowledge transfer — architecture, data flow, how to extend |
| [`docs/API.md`](docs/API.md) | Complete REST API reference with request/response examples |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Original architecture design notes |

---

## Data Model (Room)

```typescript
{
  id: string,                          // rm_{rightmoveId}
  title: string,                       // Property address
  location: {
    area: string,                      // Full address string
    postcode?: string,                 // UK postcode (e.g. "E1 1AA")
  },
  price: {
    amount: number,                    // Monthly rent in GBP
    frequency: "weekly" | "monthly"
  },
  details: {
    bedrooms?: number,                 // 0 = studio
    bathrooms?: number,
    propertyType?: "flat" | "house" | "studio" | "bungalow" | "terraced" | "semi-detached",
    furnished?: "furnished" | "unfurnished" | "part-furnished",
    epcRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G",
    leaseType?: "long-term" | "short-term",
    availableDate?: string             // ISO date
  },
  amenities?: {
    garden?: boolean,
    parking?: boolean,
    gym?: boolean,
    balcony?: boolean
  },
  agentName?: string,
  url: string,
  scraped_at: string                   // ISO datetime
}
```

---

## Adding a New Scraper

See the detailed guide in [`docs/KT.md#adding-a-new-scraper`](docs/KT.md).

Short version:
1. Add a Zod schema to `shared/src/schemas/`
2. Create `backend/src/scrapers/{motive}/{Source}Scraper.ts` extending `BaseScraper<T>`
3. Register the motive+source pair in `backend/src/server.ts`
4. Create a frontend page in `frontend/src/pages/` and add a nav entry in `App.tsx`

---

## License

Personal / private project. Not licensed for redistribution.
