# newhorizon-dashboard

A minimal equity dashboard with:
- Cloudflare Worker API (auth + data)
- Cloudflare Pages static frontend
- Local scripts to push data from Excel/text

## Repo Structure
- pages/        Static frontend (Pages build output)
- cloudflare/   Worker source + wrangler config
- local/        Local scripts (run on your machine only)

## Prereqs
- Node.js 18+
- Cloudflare account
- Wrangler installed via npm

## Setup
1) Install dependencies
   npm install

2) Configure Cloudflare Worker
   - Create a KV namespace in Cloudflare.
   - Update cloudflare/wrangler.toml with the KV id.
   - Set secrets for the Worker:
     wrangler secret put JWT_SECRET --config cloudflare/wrangler.toml
     wrangler secret put UPDATE_KEY --config cloudflare/wrangler.toml
     wrangler secret put ALLOWED_ADDRESSES --config cloudflare/wrangler.toml

3) Deploy Worker
   npm run deploy:worker

4) Deploy Pages
   - Connect this GitHub repo in Cloudflare Pages
   - Build command: (leave empty)
   - Build output directory: pages

5) Configure Frontend API
   - Edit pages/app.js and set API to your Worker URL

## Local Data Push
Local files are not deployed to Cloudflare. They run on your machine.

Required files in repo root (not committed):
- equity.xlsx
- analysis.txt
- local/.env

Example local/.env:
WORKER_URL=https://your-worker-domain
UPDATE_KEY=your_update_key

Push once:
   npm run push

Watch for changes:
   npm run watch

## API Endpoints
- POST /challenge   -> get login message with nonce
- POST /verify      -> verify signature + whitelist, returns JWT
- POST /update      -> update KV data (requires x-update-key)
- GET  /data        -> returns equity + analysis (requires JWT)

