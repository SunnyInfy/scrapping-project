# GSD (Get Shit Done) - Project Plan

## 🎯 The Actual Goal
Build an on-demand, multi-motive web scraping platform targeted at the UK market (Rooms, Jobs, Deals). The system must allow users to initiate and filter scrapes via a modern Web UI, orchestrate reliable headless browser scraping in the backend, and persist normalized data to JSON/CSV files. 

## 🛠️ Finalized Tech Stack
- **Monorepo:** `npm workspaces` for shared code (types, schemas).
- **Language:** TypeScript across the entire stack.
- **Frontend:** React 18, Vite, Vanilla CSS, TanStack Query, TanStack Table.
- **Backend API:** Node.js v20, Express, Zod (Validation), `node-cache`.
- **Scraping Engine:** Playwright (Headless Browser), Cheerio (Fast HTML parsing), `p-queue` (Concurrency & Rate Limiting).
- **Data Storage:** Local File System (`fs/promises` writing JSON/CSV).

## 🚀 Systematic Action Plan

### Phase 1: Foundation & Monorepo Setup
- [ ] Initialize monorepo structure (`backend`, `frontend`, `shared`).
- [ ] Setup TypeScript configuration across workspaces.
- [ ] Define shared Zod schemas and TypeScript models in `/shared` (Rooms, Jobs, Deals).
- [ ] Setup basic Express server in `/backend`.

### Phase 2: Core Scraping Engine
- [ ] Implement `BaseScraper` class with rate limiting (`p-queue`) and error handling.
- [ ] Implement the first targeted scraper: **Rightmove (Rooms)**.
- [ ] Build local JSON storage utility to save scraped data.

### Phase 3: Backend API Integration
- [ ] Create API endpoints: `POST /api/scrape`, `GET /api/results`.
- [ ] Integrate caching layer (`node-cache`) for fast filter retrieval.
- [ ] Implement query/filtering logic against JSON files.

### Phase 4: Frontend Development
- [ ] Scaffold Vite + React application.
- [ ] Build the UI Layout (Sidebar motives: Rooms, Jobs, Deals).
- [ ] Build the dynamic Data Table (TanStack Table) with filtering.
- [ ] Connect Frontend to Backend using TanStack Query.

### Phase 5: Expansion & Polish
- [ ] Add remaining scrapers (Indeed, Idealo, etc.).
- [ ] Add CSV Export functionality.
- [ ] UI Polish, loading states, and error boundary handling.
- [ ] Final end-to-end testing.
