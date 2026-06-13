# API Reference

Base URL: `http://localhost:3001/api`

All responses are JSON unless noted. Error responses have the shape `{ "error": "message" }`.

---

## Health Check

### `GET /api/health`

Confirms the server is running.

**Response**
```json
{
  "status": "ok",
  "message": "Scraping API is running"
}
```

---

## Scrape Control

### `POST /api/scrape/:motive/:source`

Triggers a new scrape. **Returns immediately** — the scrape runs asynchronously in the background. Poll `/api/status/:motive` to track progress.

Calling this endpoint clears all previously saved data for the motive before starting.

**URL Parameters**

| Parameter | Required | Values | Description |
|-----------|----------|--------|-------------|
| `motive` | Yes | `rooms` | Category of data to scrape |
| `source` | Yes | `rightmove` | Website to scrape from |

**Request Body**
```json
{
  "url": "https://www.rightmove.co.uk/property-to-rent/find.html?..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Full Rightmove search URL copied from the browser |

**Success Response (200)**
```json
{
  "message": "Scrape started for rooms on rightmove",
  "status": "processing"
}
```

**Error Responses**

| Status | Body | Reason |
|--------|------|--------|
| 400 | `{ "error": "URL is required in the request body." }` | Missing `url` field |
| 400 | `{ "error": "Scraper for motive 'X' and source 'Y' is not yet implemented." }` | Unknown motive/source combination |

**Notes**
- Only `rooms` + `rightmove` is currently implemented
- The scrape is rate-limited to 1 page per 2 seconds by default
- Maximum results per scrape: 5,000

---

## Scrape Status

### `GET /api/status/:motive`

Returns the current scraping status. Call this repeatedly (every 2s) while a scrape is in progress to get live progress.

**URL Parameters**

| Parameter | Required | Values |
|-----------|----------|--------|
| `motive` | Yes | `rooms`, `jobs`, `deals` |

**Response**
```json
{
  "status": "scraping",
  "count": 240,
  "total": 1256
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"idle"` \| `"scraping"` \| `"error"` |
| `count` | number | Number of results scraped so far |
| `total` | number | Total results detected on page 1 (0 if not parseable) |

**Status Values**

| Status | Meaning |
|--------|---------|
| `idle` | No scrape running. `count` shows results from the last completed scrape. |
| `scraping` | Scrape in progress. Poll until status changes. |
| `error` | Scrape failed. Check backend logs. `count` will be 0. |

**Notes**
- Returns `{ status: "idle", count: 0, total: 0 }` if no scrape has ever been triggered for this motive
- `total` is `0` when Rightmove's total count selector could not be parsed — the progress bar will not show a percentage in this case

---

## Results

### `GET /api/results/:motive`

Returns all scraped results for a motive. Data is served from an in-memory cache (5-minute TTL) or read from disk on first access.

**URL Parameters**

| Parameter | Required | Values |
|-----------|----------|--------|
| `motive` | Yes | `rooms`, `jobs`, `deals` |

**Success Response (200)**
```json
{
  "data": [ /* Array of Room objects */ ],
  "motive": "rooms",
  "source": "cache"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | Room[] | Array of scraped room objects |
| `motive` | string | Echoed motive parameter |
| `source` | `"cache"` \| `"disk"` | Whether data was served from memory or disk |

**Room Object**
```json
{
  "id": "rm_123456789",
  "motive": "rooms",
  "source": "Rightmove",
  "title": "2 bed flat to rent, Flat 4, High Street, London, E1 1AA",
  "location": {
    "area": "2 bed flat to rent, Flat 4, High Street, London, E1 1AA",
    "postcode": "E1 1AA"
  },
  "price": {
    "amount": 2200,
    "currency": "GBP",
    "frequency": "monthly"
  },
  "details": {
    "bedrooms": 2,
    "bathrooms": 1,
    "propertyType": "flat",
    "furnished": "furnished",
    "epcRating": "C",
    "leaseType": "long-term",
    "availableDate": "2024-02-01"
  },
  "amenities": {
    "garden": false,
    "parking": true,
    "gym": false,
    "balcony": true
  },
  "agentName": "Example Lettings Agency",
  "url": "https://www.rightmove.co.uk/properties/123456789",
  "scraped_at": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid motive." }` |
| 500 | `{ "error": "Failed to retrieve results" }` |

---

## CSV Export

### `GET /api/export/:motive`

Returns all scraped data as a downloadable CSV file. Fetches from cache if available, otherwise reads from disk.

**URL Parameters**

| Parameter | Required | Values |
|-----------|----------|--------|
| `motive` | Yes | `rooms`, `jobs`, `deals` |

**Response**

Content-Type: `text/csv`  
Content-Disposition: `attachment; filename=rooms_export_{timestamp}.csv`

**CSV Columns (in order)**

| CSV Column | Source Field | Format |
|------------|-------------|--------|
| Property Title | `title` | string |
| Location | `location.area` | string |
| Price (£/month) | `price.amount` | `£2200` |
| Frequency | `price.frequency` | Capitalized |
| Bedrooms | `details.bedrooms` | number |
| Bathrooms | `details.bathrooms` | number |
| Property Type | `details.propertyType` | Capitalized |
| Furnished | `details.furnished` | Capitalized |
| EPC Rating | `details.epcRating` | A–G |
| Garden | `amenities.garden` | `Yes` / `No` |
| Parking | `amenities.parking` | `Yes` / `No` |
| Gym | `amenities.gym` | `Yes` / `No` |
| Balcony | `amenities.balcony` | `Yes` / `No` |
| Lease Type | `details.leaseType` | Capitalized |
| Agent | `agentName` | string |
| Available From | `details.availableDate` | `DD/MM/YYYY` |
| Link | `url` | full URL |

**Error Responses**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid motive." }` |
| 404 | `{ "error": "No data found to export." }` |
| 500 | `{ "error": "Failed to export CSV" }` |

---

## History

### `GET /api/history/:motive`

Returns a list of all saved scrape files for a motive, sorted newest first. Includes metadata: result count, file size, date.

**URL Parameters**

| Parameter | Required | Values |
|-----------|----------|--------|
| `motive` | Yes | `rooms`, `jobs`, `deals` |

**Success Response (200)**
```json
[
  {
    "filename": "rightmove_2024-01-15T10-30-00-000Z.json",
    "source": "rightmove",
    "date": "2024-01-15T10:30:00.000Z",
    "size": 2457600,
    "count": 1256
  },
  {
    "filename": "rightmove_2024-01-10T08-00-00-000Z.json",
    "source": "rightmove",
    "date": "2024-01-10T08:00:00.000Z",
    "size": 1048576,
    "count": 523
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `filename` | string | Filename used for the DELETE endpoint |
| `source` | string | Scraper source (parsed from filename) |
| `date` | string | ISO datetime of file last-modified time |
| `size` | number | File size in bytes |
| `count` | number | Number of records in the file |

**Error Responses**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid motive." }` |
| 500 | `{ "error": "Failed to retrieve history" }` |

---

### `DELETE /api/history/:motive/:filename`

Deletes a specific scrape file from disk. Also clears the results cache for the motive.

**URL Parameters**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `motive` | Yes | `rooms`, `jobs`, `deals` |
| `filename` | Yes | Exact filename from `GET /api/history` response |

**Success Response (200)**
```json
{
  "success": true
}
```

**Error Responses**

| Status | Body | Reason |
|--------|------|--------|
| 400 | `{ "error": "Invalid motive." }` | Unknown motive |
| 400 | `{ "error": "Invalid filename." }` | Filename contains illegal characters (path traversal protection) |
| 500 | `{ "error": "Failed to delete file" }` | File not found or permission error |

**Security Note:** Filenames are validated against `/^[a-zA-Z0-9_\-.]+\.json$/` before any file operation. This prevents path traversal attacks (`../../etc/passwd` etc.).

---

## Error Handling Summary

All endpoints follow the same error pattern:

```json
{ "error": "Human-readable description" }
```

HTTP status codes used:
- `200` — Success
- `400` — Bad request (invalid motive, missing body field, invalid filename)
- `404` — Resource not found (no data to export)
- `500` — Internal server error (file read/write failure)

---

## API Client (Frontend)

The frontend uses an Axios instance defined in `frontend/src/services/api.ts`:

```typescript
const api = axios.create({ baseURL: 'http://localhost:3001/api' });
```

All API functions are thin wrappers:

```typescript
fetchResults(motive)               // GET /results/:motive → response.data.data
fetchStatus(motive)                // GET /status/:motive  → response.data
triggerScrape(motive, source, url) // POST /scrape/:motive/:source
fetchHistory(motive)               // GET /history/:motive → response.data
deleteHistoryItem(motive, filename)// DELETE /history/:motive/:filename
```

These functions are consumed via TanStack Query hooks (`useQuery`, `useMutation`) in page components.
