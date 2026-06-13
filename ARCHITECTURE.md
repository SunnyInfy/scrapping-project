# Web Scraping Project Architecture

## Project Overview

- **Purpose**: Multi-motive web scraper for UK market (rooms, jobs, shopping deals)
- **Scale**: 3-5 sites per motive (~9-15 sites total)
- **Frequency**: On-demand/manual scraping
- **Output Format**: CSV/JSON files
- **Interface**: Web UI (frontend + backend)
- **Tech Stack**: JavaScript/Node.js

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React/Vue)                   │
│  - Motive selector (rooms/jobs/deals)                       │
│  - Filter UI (location, price, date range, etc.)            │
│  - Results display & export (CSV/JSON)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend API (Node.js/Express)             │
│  - Scraping orchestration endpoints                         │
│  - Filter & search logic                                    │
│  - File management (CSV/JSON)                               │
│  - Cache layer (fast repeated queries)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Scraper Workers (Scalable)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Room Scrapers                                        │  │
│  │ - Rightmove.co.uk                                    │  │
│  │ - Zoopla.co.uk                                       │  │
│  │ - Spareroom.co.uk                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Job Scrapers                                         │  │
│  │ - Indeed.co.uk                                       │  │
│  │ - LinkedIn.com (UK jobs)                             │  │
│  │ - Reed.co.uk                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Shopping Deal Scrapers                               │  │
│  │ - Idealo.co.uk                                       │  │
│  │ - PriceSpy.co.uk                                     │  │
│  │ - Amazon.co.uk (deals)                               │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Storage & Extraction Layer                │
│  - Puppeteer/Playwright (headless browser scraping)         │
│  - Cheerio (lightweight HTML parsing)                       │
│  - Retry logic & rate limiting                              │
│  - Data validation & cleaning                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Files & Cache                        │
│  - /data/rooms/*.json                                       │
│  - /data/jobs/*.json                                        │
│  - /data/deals/*.json                                       │
│  - /cache/*.json (filtered results cache)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack Recommendation

### Frontend

- **Framework**: React (or Vue.js for simpler needs)
- **Why**: Fast UI updates, component-based, large ecosystem
- **Libraries**:
  - `axios` - HTTP client for API calls
  - `antd` or `shadcn/ui` - UI component library
  - `react-table` - Advanced filtering/sorting tables
  - `date-fns` - Date filtering utilities

### Backend

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Why**: Lightweight, fast, full-stack JavaScript
- **Libraries**:
  - `puppeteer` or `playwright` - Headless browser automation
  - `cheerio` - Fast HTML parsing
  - `axios` - HTTP requests
  - `node-cron` - Optional: scheduled scraping
  - `express-cors` - CORS handling
  - `dotenv` - Environment config
  - `joi` - Data validation

### Data Layer

- **Format**: JSON (with CSV export)
- **Why**: Easy to parse, lightweight, flexible schema
- **Tools**:
  - `papaparse` - CSV export/import
  - `node-cache` - In-memory caching layer
  - `pino` or `winston` - Logging

### Development Tools

- **Testing**: Jest, Supertest
- **Linting**: ESLint
- **Code formatting**: Prettier
- **Container**: Docker (optional, for deployment)

---

## Data Schema Examples

### Rooms Data

```json
{
  "id": "room_uk_001",
  "motive": "rooms",
  "source": "rightmove",
  "title": "Double room in Central London",
  "location": {
    "area": "London",
    "postcode": "SW1A 1AA",
    "lat": 51.5074,
    "lng": -0.1278
  },
  "price": {
    "amount": 800,
    "currency": "GBP",
    "frequency": "monthly"
  },
  "details": {
    "bedrooms": 1,
    "bathrooms": 1,
    "furnished": "partly",
    "available_from": "2026-07-01"
  },
  "url": "https://example.com/room/123",
  "scraped_at": "2026-06-13T10:00:00Z",
  "expires_at": "2026-06-20T10:00:00Z"
}
```

### Jobs Data

```json
{
  "id": "job_uk_001",
  "motive": "jobs",
  "source": "indeed",
  "title": "Senior Developer",
  "company": "Tech Corp",
  "location": "Manchester",
  "salary": {
    "min": 45000,
    "max": 60000,
    "currency": "GBP",
    "frequency": "yearly"
  },
  "details": {
    "job_type": "Full-time",
    "experience_level": "Senior",
    "skills": ["JavaScript", "React", "Node.js"]
  },
  "url": "https://example.com/job/123",
  "scraped_at": "2026-06-13T10:00:00Z",
  "expires_at": "2026-06-27T10:00:00Z"
}
```

### Deals Data

```json
{
  "id": "deal_uk_001",
  "motive": "shopping",
  "source": "idealo",
  "product_name": "Laptop XYZ",
  "category": "Electronics",
  "price": {
    "current": 799.99,
    "original": 999.99,
    "discount_percent": 20,
    "currency": "GBP"
  },
  "merchant": "Amazon UK",
  "rating": 4.5,
  "url": "https://example.com/product/123",
  "scraped_at": "2026-06-13T10:00:00Z",
  "expires_at": "2026-06-20T10:00:00Z"
}
```

---

## Key Design Patterns

### 1. **Modular Scraper Architecture**

- Separate scraper class for each website
- Common interface: `BaseScraper` class
- Easy to add new websites without touching core logic

### 2. **Rate Limiting & Respect**

- Implement delays between requests (1-3 seconds)
- Respect `robots.txt`
- Use rotating user agents
- Proxy rotation for high-volume scraping

### 3. **Error Handling & Retry Logic**

- Exponential backoff for failed requests
- Max retry attempts (3-5)
- Fallback data sources

### 4. **Data Validation Pipeline**

- Schema validation on each record
- Data normalization (prices, dates)
- Duplicate detection & merging

### 5. **Caching Strategy**

- In-memory cache for repeated queries
- File-based cache for expensive scrapes
- Cache invalidation based on age (expires_at)

### 6. **Filter Engine**

- Dynamic query builder (location, price range, date, keywords)
- Indexing for fast filtering
- Full-text search on descriptions

---

## Performance Optimization Strategies

### For Fast Scraping:

1. **Parallel Scraping**: Use Worker Threads or Clustering
   - Scrape multiple sites simultaneously
   - But respect rate limits per domain

2. **Browser Optimization**:
   - Use Playwright headless mode (faster than Puppeteer)
   - Disable images/CSS if not needed
   - Reuse browser instances

3. **Caching Layers**:
   - Cache HTML responses
   - Cache parsed results
   - Cache filter results

4. **Data Streaming**:
   - Stream large result sets instead of loading all in memory
   - Pagination for UI

### For Fast Filtering:

1. **In-Memory Indexing**:
   - Build indexes on common filter fields
   - Use Maps for O(1) lookups

2. **Query Optimization**:
   - Apply most restrictive filters first
   - Use Set intersection for multi-filter queries

3. **Lazy Loading**:
   - Load data on demand
   - Progressive enhancement in UI

---

## File Structure

```
scraping-project/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── scrape.js
│   │   │   ├── filter.js
│   │   │   └── export.js
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   └── index.js (Express setup)
│   ├── scrapers/
│   │   ├── BaseScraper.js
│   │   ├── rooms/
│   │   │   ├── RightmoveScraper.js
│   │   │   ├── ZooplaScraper.js
│   │   │   └── SpareRoomScraper.js
│   │   ├── jobs/
│   │   │   ├── IndeedScraper.js
│   │   │   ├── LinkedInScraper.js
│   │   │   └── ReedScraper.js
│   │   └── deals/
│   │       ├── IdealoScraper.js
│   │       ├── PriceSpyScraper.js
│   │       └── AmazonScraper.js
│   ├── filters/
│   │   ├── FilterEngine.js
│   │   └── QueryBuilder.js
│   ├── utils/
│   │   ├── cache.js
│   │   ├── logger.js
│   │   ├── validators.js
│   │   └── retry.js
│   └── config/
│       └── config.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/ (API calls)
│   │   └── App.jsx
│   └── package.json
├── data/
│   ├── rooms/
│   ├── jobs/
│   ├── deals/
│   └── cache/
├── tests/
├── docker-compose.yml (optional)
├── .env.example
├── package.json
└── README.md
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

- Set up Node.js backend with Express
- Create BaseScraper class
- Implement 1 scraper per motive (3 total)
- Basic JSON file storage

### Phase 2: Core Features (Week 2)

- Filter engine with query builder
- Basic frontend (React + search)
- Export to CSV/JSON
- Error handling & retry logic

### Phase 3: Optimization (Week 3)

- Parallel scraping
- Caching layer
- Performance testing
- Rate limiting

### Phase 4: Polish (Week 4)

- UI improvements
- Advanced filtering
- Logging & monitoring
- Documentation

---

## Important Considerations

1. **Legal/Ethical**:
   - Check each site's Terms of Service
   - Respect robots.txt
   - Don't overload servers
   - Consider using official APIs where available

2. **Maintenance**:
   - Website layouts change → scrapers need updates
   - Store scraping dates to know freshness
   - Monitor for breaking changes

3. **Scalability**:
   - Future: Add message queue (Bull/RabbitMQ) for job scheduling
   - Future: Move to database (PostgreSQL) if data grows
   - Future: Add job scheduling (node-cron or separate scheduler)

4. **Security**:
   - Validate all input filters
   - Use environment variables for sensitive config
   - CORS configuration for frontend
   - Rate limit API endpoints

---

## Quick Start Next Steps

1. Create Express backend skeleton
2. Implement BaseScraper class
3. Create 1 room scraper (Rightmove)
4. Build basic filter API
5. Create React frontend with search/filter UI
6. Connect frontend to backend
7. Add export functionality
8. Optimize for speed

Would you like to proceed with implementation?
