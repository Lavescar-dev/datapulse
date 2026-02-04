# DataPulse — Implementation Guide

## Overview
- **Name**: DataPulse
- **Type**: Rust binary (backend) + SvelteKit static (frontend)
- **Stack**: Backend: Rust, Axum, Tokio, DashMap. Frontend: SvelteKit, Svelte 5, Tailwind CSS v4, Chart.js, lucide-svelte
- **Subdomain**: datapulse.lavescar.com.tr
- **Idle RAM**: ~5MB (backend only)
- **Disk**: ~8MB (backend binary + static files)

## Architecture
Two-tier architecture with a Rust API backend and a SvelteKit static frontend. The backend serves mock data and simulates scraper operations via SSE streams. The frontend is pre-built as static files and served by Nginx, which also proxies `/api/` requests to the Rust backend. All data is pre-baked mock data -- no actual web scraping occurs. The backend uses DashMap for concurrent state management and rate limiting.

## Features
- Dashboard with aggregate statistics and charts
- 8 mock scrapers with SSE progress simulation:
  - E-commerce price tracking
  - Social media trends
  - News feed aggregation
  - Crypto price monitoring
  - Weather data collection
  - (3 additional scraper types)
- Real-time scraper progress via Server-Sent Events
- Rate limiting per IP
- Responsive dashboard UI with Chart.js visualizations
- Dark-themed data analytics interface

## Demo Credentials
No credentials needed. The demo is publicly accessible.

## Demo Safety Measures
- All data is pre-baked mock data; no real web scraping is performed
- Rate limiting on API endpoints
- DEMO watermark displayed in the UI
- `noindex` in `robots.txt` prevents search engine indexing
- No external network calls from the backend
- systemd resource limits on the backend process

## Build & Deploy
```bash
# Build backend
cd demos/datapulse/backend
cargo build --release
# Binary output: target/release/datapulse_backend

# Build frontend
cd demos/datapulse/frontend
bun install
bun run build

# Deploy backend
sudo cp backend/target/release/datapulse_backend /opt/datapulse/datapulse_backend
sudo cp deploy/datapulse.service /etc/systemd/system/  # if exists
sudo systemctl daemon-reload
sudo systemctl enable --now datapulse

# Deploy frontend
sudo cp -r frontend/build/* /var/www/datapulse/

# Nginx: serves static frontend + proxies /api/ to backend on port 8081
```

## File Structure
```
datapulse/
├── .env                        # Environment variables
├── .env.example                # Example env config
├── backend/
│   ├── Cargo.toml              # Rust dependencies
│   └── src/
│       ├── config.rs           # Configuration loading
│       ├── rate_limiter.rs     # IP-based rate limiter
│       ├── state.rs            # Shared application state
│       ├── mock_data/          # Pre-baked mock datasets
│       └── routes/             # API route handlers
├── frontend/
│   ├── package.json            # Node dependencies
│   ├── svelte.config.js        # SvelteKit configuration
│   ├── vite.config.ts          # Vite build config
│   ├── tsconfig.json           # TypeScript config
│   ├── static/
│   │   └── robots.txt          # noindex directive
│   └── src/
│       ├── app.html            # HTML shell
│       ├── app.css             # Global styles
│       ├── app.d.ts            # Type declarations
│       ├── lib/
│       │   ├── index.ts        # Lib exports
│       │   └── assets/
│       │       └── favicon.svg
│       └── routes/
│           ├── +layout.svelte  # Root layout
│           └── +page.svelte    # Main dashboard page
```

## Key Design Decisions
- **Rust backend for simulation**: Provides efficient SSE streaming and low memory usage even with concurrent mock scraper sessions.
- **Static frontend**: SvelteKit builds to static files, keeping the frontend zero-cost at runtime (served by Nginx).
- **Mock-only data**: Eliminates legal and ethical concerns of real web scraping in a demo context.
- **SSE for progress**: Simulates real-time scraper feedback without WebSocket complexity.
- **Aggressive Rust release profile**: `opt-level = "z"` with LTO for minimal binary size.
- **Separated concerns**: Backend and frontend are independently buildable and deployable.

## Verification Checklist
- [ ] `cargo build --release` in `backend/` completes without errors
- [ ] `bun run build` in `frontend/` produces a `build/` directory
- [ ] Backend starts and listens on port 8081
- [ ] Frontend `index.html` loads in browser
- [ ] Dashboard displays stats and charts
- [ ] Triggering a scraper shows SSE progress updates
- [ ] Rate limiting activates after threshold
- [ ] DEMO watermark is visible
- [ ] `robots.txt` contains `Disallow: /`
- [ ] No outbound network requests from the backend (verify with `ss` or logs)
