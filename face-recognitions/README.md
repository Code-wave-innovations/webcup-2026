# Face recognition engine

Flask API powered by **InsightFace (SCRFD + ArcFace)**, with multi-sample enrollment, 1:1 verify, 1:N identify, and passive liveness (heuristic + optional ONNX anti-spoof).

> Software RGB only — not equivalent to iPhone TrueDepth / Secure Enclave.

## Quick start

Requires **Python 3.10–3.11** (not 3.14).

```bash
cd face-recognitions
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/download_models.py   # buffalo_s ~120MB → ~/.insightface
python api_pro.py
```

Health: `GET http://localhost:9000/health`

Frontend demo: open `http://localhost:5173/face` (set `VITE_FACE_API_URL` in `frontend/.env`).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Engine status + thresholds |
| GET | `/identities` | List enrolled names |
| POST | `/enroll` | Multipart `name` + `img` (or `img0..`) — needs ≥3 samples |
| POST | `/identify` | 1:N match |
| POST | `/verify` | 1:1 — form `name` + `img` (+ liveness) |
| DELETE | `/identities/<name>` | Remove identity |

Legacy aliases: `POST /create-dataset`, `POST /recognize`, `DELETE /delete-dataset`.

When `FACE_API_KEY` is set, send header `X-API-Key`.

### Example enroll (3 frames)

```bash
curl -X POST http://localhost:9000/enroll \
  -H "X-API-Key: $FACE_API_KEY" \
  -F name=alice \
  -F img0=@a1.jpg -F img1=@a2.jpg -F img2=@a3.jpg
```

## Liveness / anti-spoof

Default: RGB heuristics (demo-grade). For stronger passive spoof detection, place MiniFASNet / Silent-Face-Anti-Spoofing `.onnx` files in `models/anti_spoof/`.

## Docker

```bash
docker build -t face-engine .
docker run --rm -p 9000:9000 -e FACE_API_KEY=secret face-engine
```

## Production (VPS + DuckDNS + SSL)

Requirements: Linux VPS, Docker + Compose plugin, free [DuckDNS](https://www.duckdns.org) subdomain.

### Option 2 (recommended if :80/:443 already used) — host nginx reverse-proxy

Public **80/443** stay on system nginx; Docker listens on **84** (HTTP only). Let's Encrypt still validates on public :80 via the host proxy.

```bash
cd face-recognitions
cp .env.prod.example .env.prod
# Set DOMAIN, DUCKDNS_*, LETSENCRYPT_EMAIL (real email), FACE_API_KEY, FACE_CORS_ORIGINS
# Keep: HTTP_PORT=84  HTTPS_PORT=447  FORCE_HTTP=1

sudo apt-get install -y nginx   # if not already installed
chmod +x deploy/host-nginx/install-host-nginx.sh deploy/certbot/init-ssl.sh

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
sudo ./deploy/host-nginx/install-host-nginx.sh http
# Check: curl -sS http://127.0.0.1:84/health  and  curl -sS http://webcup.duckdns.org/health

sudo ./deploy/certbot/init-ssl.sh
# Switches host nginx to TLS automatically when FORCE_HTTP=1

curl -fsS https://webcup.duckdns.org/health
```

After renewals, reload **host** nginx so it re-reads certs under `data/letsencrypt/`:

```bash
sudo nginx -s reload
```

### Option 1 — Docker binds :80/:443 directly

Set `HTTP_PORT=80`, `HTTPS_PORT=443`, `FORCE_HTTP=0`, free those ports, then `./deploy/certbot/init-ssl.sh`.

3. Point the frontend `VITE_FACE_API_URL` to `https://your-subdomain.duckdns.org`.

**Known limitation:** behind nginx, the app's rate limiter sees the nginx container IP (no `ProxyFix` yet), so `FACE_RATE_LIMIT` is effectively shared across all clients. Follow-up: wrap the Flask app with werkzeug `ProxyFix`.

Local/simple Docker without TLS remains: `docker compose up -d` (see `docker-compose.yml`).

## Calibrated thresholds (starting points)

Documented defaults for `buffalo_s` on webcam RGB:

| Mode | Env | Default | Notes |
|------|-----|---------|-------|
| Verify 1:1 | `FACE_VERIFY_THRESHOLD` | 0.45 | Cosine on normed ArcFace |
| Identify 1:N | `FACE_IDENTIFY_THRESHOLD` | 0.40 | Slightly looser; tune on your set |
| Liveness | `FACE_LIVENESS_THRESHOLD` | 0.55 | Heuristic/ONNX blend |

Measure TP/FP on a small held-out set before production use.
