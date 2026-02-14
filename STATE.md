# STATE — Datapulse Demo
Date: 2026-02-04 (UTC snapshot)

Status: `DEGRADED`

Public URL: `https://datapulse.lavescar.com.tr`  
Origin URL (resolve): `curl -I --resolve datapulse.lavescar.com.tr:443:91.99.192.155 https://datapulse.lavescar.com.tr`

Current Deploy:
- Static symlink: `/var/www/lavescar/demos/datapulse/current -> /var/www/lavescar/demos/datapulse/releases/20260204_071957`
- Backend symlink: `/opt/lavescar/demos/datapulse/current -> /opt/lavescar/demos/datapulse/releases/20260204_071957`
- Service: `datapulse`
- Active Ports: `443` (nginx static), `18084` (backend)

Evidence (commands + observed result):
- `curl -I https://datapulse.lavescar.com.tr` -> `HTTP/2 200`, `content-type: text/html`, `cache-control: no-store...`, `cf-cache-status: DYNAMIC`, `x-robots-tag: noindex...`
- `curl -I --resolve datapulse.lavescar.com.tr:443:91.99.192.155 https://datapulse.lavescar.com.tr` -> `HTTP/2 200`, `server: nginx`
- Asset cache probe:
  - `curl -I https://datapulse.lavescar.com.tr/_app/immutable/entry/start.CQifXwKT.js`
  - Result: `cache-control: public, max-age=31536000, immutable`
- API probe:
  - `curl -fsS https://datapulse.lavescar.com.tr/api/dashboard/stats | head` -> JSON dönüyor
  - `curl -I https://datapulse.lavescar.com.tr/api/health` -> `404`
- Service health:
  - `systemctl status datapulse --no-pager` -> `active (running)`
  - `journalctl -u datapulse -n 200 --no-pager` -> son restart sonrası error görünmüyor
- Nginx vhost proof:
  - `nginx -T | grep -nE 'server_name (datapulse)\\.lavescar\\.com\\.tr'`
  - `/etc/nginx/sites-available/datapulse.lavescar.com.tr` satır `14-18`: `/api/` proxy, satır `20-21`: cache+spa include

Known Issues:
1. `GET /api/health` endpoint’i yok (`404`), monitoring standardı eksik.  
   Evidence: `curl -I https://datapulse.lavescar.com.tr/api/health`
2. Backend CORS policy geniş (source code: `allow_origin(Any)`), prod hardening gerekli.  
   Evidence: `demos/datapulse/backend/src/main.rs`
3. `x-demo-mode` header standardizasyonu sadece Nexus’ta mevcut.  
   Evidence: `curl -I https://datapulse.lavescar.com.tr`

Next Actions:
- `IMPLEMENTATION.md` §2.1 (`/api/health` endpoint)
- `IMPLEMENTATION.md` §2.2 (CORS hardening)
- `IMPLEMENTATION.md` §3 (UX reliability polish)
