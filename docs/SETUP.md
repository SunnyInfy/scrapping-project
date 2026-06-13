# Local Setup Guide

This guide walks you through every step to get ScrapeMaster running on your machine from scratch.

---

## Prerequisites

Before you begin, install the following tools.

### 1. Node.js

**Required version:** Node.js 18 or later (project uses Node 24 in dev).

Download from https://nodejs.org/ or use a version manager:

```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Verify
node -v    # should print v18.x.x or higher
npm -v     # should print 9.x.x or higher
```

### 2. Git

```bash
git --version    # should be installed on most systems
```

### 3. Windows-specific notes

- Use **Git Bash**, **WSL2**, or **PowerShell** — all commands in this guide use Unix syntax
- If you see `\` vs `/` path errors, make sure you are in a Unix-style shell

---

## Clone the Repository

```bash
git clone <your-repo-url> scrapping-project
cd scrapping-project
```

---

## Install Dependencies

This is an npm workspaces monorepo. One command installs all packages for all three workspaces (shared, backend, frontend):

```bash
npm install
```

You should see packages installed for:
- Root (npm-run-all, tsx, typescript)
- `shared` (zod)
- `backend` (express, playwright, cheerio, papaparse, etc.)
- `frontend` (react, vite, tanstack packages, etc.)

---

## Install Playwright Browser

Playwright needs to download a Chromium browser binary before the scraper can run. This is a one-time step (~200 MB download).

```bash
cd backend
npx playwright install chromium
cd ..
```

If prompted about system dependencies on Linux, also run:

```bash
npx playwright install-deps chromium
```

To verify the browser is installed:

```bash
cd backend
npx playwright --version
```

---

## Build the Shared Package

The `shared` package must be compiled before backend or frontend can import types from it.

```bash
npm run build:shared
```

This runs `tsc` inside `shared/` and outputs to `shared/dist/`. You only need to do this once after cloning, or whenever you change files inside `shared/src/`.

---

## Environment Variables

The project works out of the box with no `.env` file required.

Optional overrides (create `backend/.env` if needed):

```env
PORT=3001   # Backend port (default: 3001)
```

The frontend API base URL is hardcoded to `http://localhost:3001` in `frontend/src/services/api.ts`. If you change the backend port, update that file too.

---

## Running the Project

### Option A — Everything with one command (recommended)

From the project root:

```bash
npm run dev
```

This script (defined in root `package.json`):
1. Builds the shared package
2. Starts the backend dev server in watch mode
3. Starts the frontend Vite dev server

Both services run in parallel in the same terminal window.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |

### Option B — Separate terminals

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

---

## Verify Everything is Working

1. Open http://localhost:5173 — you should see the ScrapeMaster UI with a sidebar
2. Open http://localhost:3001/api/health — should return `{"status":"ok","message":"Scraping API is running"}`
3. Try a test scrape:
   - Paste a Rightmove URL into the input field
   - Click **Trigger Scrape**
   - The progress bar should appear and update every 2 seconds

---

## Data Storage

Scraped data is saved as JSON files under `data/` in the project root (created automatically):

```
data/
└── rooms/
    ├── rightmove_2024-01-15T10-30-00-000Z.json
    └── rightmove_2024-01-16T09-15-00-000Z.json
```

This directory is `.gitignore`d — your scraped data will not be committed to git.

---

## Production Build

To compile everything for production:

```bash
npm run build
```

This runs:
1. `npm run build:shared` — Compiles shared TypeScript
2. `npm run build:backend` — Compiles backend TypeScript to `backend/dist/`
3. `npm run build:frontend` — Runs `tsc` + Vite build to `frontend/dist/`

To run the compiled backend:

```bash
node backend/dist/server.js
```

To serve the compiled frontend, use any static file server pointed at `frontend/dist/`.

---

## Troubleshooting

### `Cannot find module 'papaparse'` or similar

Some packages may not have installed correctly into the workspace. Fix:

```bash
npm install papaparse node-cache --workspace=backend
```

### Backend starts but scraper never returns results

1. Check if Playwright's Chromium is installed: `cd backend && npx playwright install chromium`
2. Check backend console for errors — Rightmove may be blocking headless browsers
3. Try the diagnose script: `cd backend && npm run dev` then check `src/scripts/diagnose.ts`

### Frontend shows blank page

1. Make sure you ran `npm run build:shared` at least once
2. Check the browser console for import errors
3. Confirm Vite is running on port 5173

### Port 3001 already in use

Either stop the existing process or override the port:

```bash
# Find what is using port 3001 (Windows)
netstat -ano | findstr :3001

# Run backend on a different port
PORT=3002 npm run dev --workspace=backend
```

Then update `frontend/src/services/api.ts`:
```typescript
const API_BASE_URL = 'http://localhost:3002/api';
```

### `npm install` fails with peer dependency errors

```bash
npm install --legacy-peer-deps
```

### TypeScript errors after pulling latest changes

```bash
npm run build:shared
```

Shared types must be rebuilt whenever `shared/src/` changes.

### Scrape finishes but table shows no data

The scraper clears old data before each new scrape. If you see 0 results:
1. Check the backend console — look for `[Rightmove] Scraped 0 unique rooms`
2. Rightmove may have changed their HTML selectors. Check `RightmoveScraper.ts` and update `[data-testid^="propertyCard-"]` if needed.

---

## Useful Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start everything (recommended) |
| `npm run build` | Production build of all packages |
| `npm run build:shared` | Rebuild shared types only |
| `npm run dev:backend` | Backend only in watch mode |
| `npm run dev:frontend` | Frontend only |
| `cd backend && npm run test:scrape` | Run a one-off scrape test without the UI |

---

## IDE Setup

### VS Code (recommended)

Install these extensions for the best experience:

- **ESLint** — `dbaeumer.vscode-eslint`
- **Prettier** — `esbenp.prettier-vscode`
- **TypeScript Vue Plugin (Volar)** — `Vue.volar` (not needed but TypeScript import support helps)
- **Tailwind CSS IntelliSense** — not needed (project uses plain CSS)

The project uses TypeScript strict mode throughout. VS Code will show inline type errors automatically.

### Recommended settings (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```
