# DataPulse - New Stack (Astro 5 + Hono + Bun)

This is the new DataPulse application built with modern technologies.

## Tech Stack

- **Frontend**: Astro 5 + SolidJS + Tailwind CSS v4
- **Backend**: Hono + Bun runtime
- **Type Sharing**: TypeScript monorepo with shared types
- **Authentication**: JWT-based sessions with admin and demo modes

## Project Structure

```
app/
├── frontend/          # Astro 5 frontend application
│   ├── src/
│   │   ├── pages/     # Astro pages
│   │   ├── components/# SolidJS components
│   │   └── styles/    # Global styles
│   └── package.json
├── backend/           # Hono API server
│   ├── auth/          # Authentication logic
│   ├── middleware/    # Auth & rate limiting
│   ├── services/      # External API integrations
│   ├── cache/         # Caching layer
│   ├── cron/          # Scheduled tasks
│   └── index.ts       # Server entry point
├── shared/            # Shared TypeScript types
│   └── types/         # Type definitions
└── package.json       # Monorepo workspace config
```

## Getting Started

### Prerequisites

- Bun (v1.3+)

### Installation

```bash
# Install dependencies
bun install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Update the environment variables as needed

### Development

```bash
# Run both frontend and backend in development mode
bun run dev

# Or run them separately:
bun run dev:frontend  # Frontend on http://127.0.0.1:3031
bun run dev:backend   # Backend on http://127.0.0.1:8031
```

### Build

```bash
# Build frontend for production
bun run build

# Preview production build
bun run preview
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: Admin credentials
- `PORT`: Backend server port (default: 8131 locally, `8080` on Cloud Run)
- `JWT_SECRET`: Secret key for JWT signing
- `REDIS_URL`: Optional Redis connection (falls back to file cache)
- `DEMO_SESSIONS_PER_IP`: Max demo sessions per IP per day (default: 3)
- `DEMO_SESSION_DURATION_MINUTES`: Session duration (default: 30)
- `DATAPULSE_API_PROXY_TARGET`: Astro dev proxy target for `/api` and `/health`
- `DATAPULSE_API_BASE_URL`: Server-side absolute API base for Astro
- `PUBLIC_DATAPULSE_API_BASE_URL`: Browser-side absolute API base for cross-origin production deploys
- `CORS_ORIGINS`: Comma-separated frontend origins allowed to call the backend with credentials
- `COOKIE_SECURE`: Set to `true` behind HTTPS in production
- `COOKIE_SAME_SITE`: Use `None` for cross-site frontend/backend deployments, `Lax` for same-site setups

## Local Port Defaults

- Astro dev/preview runs on `127.0.0.1:3031`
- Hono/Bun backend runs on `127.0.0.1:8131`
- Frontend requests `/api` and `/health` through Astro's local proxy in local development

## Production Deployment

### Recommended split

- Frontend: Cloudflare Pages
- Backend: Google Cloud Run
- API hostname: `api.your-domain.com`

This repo is already prepared for a split-origin deployment:

- browser-side requests can use `PUBLIC_DATAPULSE_API_BASE_URL`
- backend CORS accepts env-driven origins through `CORS_ORIGINS`
- cookies can be upgraded to secure mode with `COOKIE_SECURE=true`
- cross-site session cookies need `COOKIE_SAME_SITE=None`

### Cloudflare Pages

Set the Pages project like this:

- Root directory: leave blank
- Build command: `cd app/frontend && bun install && bun run build`
- Build output directory: `app/frontend/dist`

Recommended Pages environment variables:

```bash
PUBLIC_DATAPULSE_API_BASE_URL=https://api.your-domain.com
```

For local or preview environments you can still omit this and rely on the Astro proxy.

### Google Cloud Run

Build the backend container from `app`:

```bash
docker build -f Dockerfile -t datapulse-backend .
```

Or with Google Cloud Build:

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/datapulse-backend app
```

Deploy to Cloud Run:

```bash
gcloud run deploy datapulse-backend \
  --image gcr.io/YOUR_PROJECT_ID/datapulse-backend \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars PORT=8080,CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com,COOKIE_SECURE=true,COOKIE_SAME_SITE=None,DATAPULSE_API_BASE_URL=https://api.your-domain.com
```

Recommended additional secrets and config:

- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `REDIS_URL` if you move beyond file cache

### DNS / Routing

Recommended public shape:

- `https://your-domain.com` -> Cloudflare Pages
- `https://api.your-domain.com` -> Cloud Run custom domain

## Features

- Real-time cryptocurrency tracking (top 100 coins)
- Fear & Greed Index
- Market statistics and BTC dominance
- Interactive charts with multiple time ranges
- Demo session flow with rate limiting
- Admin authentication
- 5-minute data caching
