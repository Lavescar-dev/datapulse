# IMPLEMENTATION — Datapulse (Execution-Ready)
Date: 2026-02-04

## 1) Problem List (Evidence)

1. Standart health endpoint yok.
- Evidence: `curl -I https://datapulse.lavescar.com.tr/api/health` => `404`.
- Hypothesis: backend route setinde health unutulmuş.

2. CORS policy fazla geniş.
- Evidence: `demos/datapulse/backend/src/main.rs` içinde `allow_origin(Any)`.
- Hypothesis: demo kolaylığı için permissive bırakılmış.

3. Browser-level regression matrisi tamamlanmadı.
- Evidence: CLI smoke var; DevTools console/network kanıtı yok.

## 2) Fix Plan (Smallest Safe Steps)

### 2.1 Add health endpoint
- Files:
  - `demos/datapulse/backend/src/main.rs`
- Change type: code
- Change:
  - `GET /api/health` veya `GET /health` JSON endpoint (`{"status":"ok"}`).
- Risk: low
- Rollback:
  - Yeni route’u kaldır, binary redeploy.

### 2.2 CORS hardening
- Files:
  - `demos/datapulse/backend/src/main.rs`
- Change type: code/config
- Change:
  - `allow_origin(Any)` -> explicit allow list:
    - `https://datapulse.lavescar.com.tr`
    - gerektiğinde local dev origin.
- Risk: medium (yanlış allow list request kırabilir)
- Rollback:
  - öncekine dön veya temporary broader allow list.

### 2.3 Nginx/API safety validation
- Files:
  - `/etc/nginx/sites-available/datapulse.lavescar.com.tr`
- Change type: validate-only (gerekirse config)
- Change:
  - `/api/` location’ın SPA fallback üstünde kaldığını koru.
  - `nginx -t && reload` sonrası tekrar smoke.
- Risk: low
- Rollback: vhost revert.

## 3) UI/UX Value Plan (0-bloat)

1. Dashboard empty/error state:
- File: `demos/datapulse/frontend/src/routes/+page.svelte`
- Add: API fail durumunda kısa “data source unavailable” paneli + retry.

2. Module loading skeleton:
- File: `demos/datapulse/frontend/src/routes/news/+page.svelte`
- Add: lightweight skeleton while async data waits.

3. Onboarding copy:
- File: `demos/datapulse/frontend/src/routes/+layout.svelte`
- Add: top hint “Synthetic demo data / not live trading advice”.

## 4) DoD

1. Public root `200`.
2. SPA refresh `200`.
3. `/api/dashboard/stats` JSON stabil.
4. `/api/health` mevcut ve `200`.
5. Console uncaught error yok.
6. Cloudflare Dev Mode OFF iken davranış stabil.
