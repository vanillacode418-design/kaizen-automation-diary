# Kaizen Automation — Roadmap & Toolbox (MIT)

A single-page Kaizen automation roadmap UI with a minimal Node/Express server and webhook stubs.

## Features (summary)
- Dark neon theme (blue / purple / green)
- Sidebar Tools & Costs (editable, persist)
- 60-day roadmap grouped in phases, each day 4–8 tasks
- Task checklist with timestamps, notes (persist until edited)
- Progress bars (per-day and overall)
- Tool cost calculator with presets
- Diary (local notes, archive)
- Templates (message trees / SOPs) scaffolded in state
- Integrations panel with Twilio / WhatsApp / Vapi / n8n / GHL forms
- Webhook endpoints stubs with logging
- Export / Import JSON and Export PDF summary (jsPDF)
- Autosave to localStorage every 10s, and "Save to server" endpoint (POST /api/state)
- Simple server auth via `x-api-key` header and `API_SECRET` env var
- Mobile-friendly and accessible controls

## Install & Run (local)
1. Clone repo
2. `cp .env.example .env` and set `API_SECRET` and `PORT` if needed.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000`

## API (server)
- `GET /api/state` — returns saved state JSON (requires `x-api-key`)
- `POST /api/state` — saves state JSON to `data/state.json` (requires `x-api-key`)
- `POST /webhook/whatsapp` — webhook stub (requires `x-api-key`)
- `POST /webhook/twilio-sms` — webhook stub (requires `x-api-key`)
- `POST /webhook/vapi` — webhook stub (requires `x-api-key`)
- `POST /webhook/*` — additional stubs

Webhook calls are appended to `data/webhooks.log`.

## Deploy (Replit)
1. Create a new Replit and import the repo.
2. Add a secret `API_SECRET` in Replit secrets.
3. Set the Run command: `node server.js`
4. Start the repl. Use right panel to find the url.
5. In the UI's right panel, set Server URL to the Replit URL and API key to secret value.

## Deploy (Render)
1. Create a new Web Service pointing at the repo.
2. Build command: `npm ci`
3. Start command: `node server.js`
4. Set environment variable `API_SECRET` in Render dashboard.

## Deploy (GitHub Pages)
This requires a different server for webhook endpoints; prefer Render / Replit for full functionality.

## Data model (saved to localStorage and /api/state)
See `public/script.js` for the full JSON structure — includes meta, tools, costs, roadmap, templates, diary, settings.

## Sample webhook payloads
(Examples are shown in-app under Integrations → "Open")

## Security
Server POST endpoints require `x-api-key` to equal `API_SECRET`.

## License
MIT
