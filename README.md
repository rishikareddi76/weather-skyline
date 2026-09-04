# Skyline — weather station (single file + AI Q&A)

The UI — markup, styling, and logic — lives in one file: `index.html`.
Weather data comes from the free, keyless [Open-Meteo](https://open-meteo.com)
API. One small serverless function (`functions/api/ask.js`) adds a chat box
that answers questions about the current forecast using Claude.

```
weather-app-single/
├── index.html          the entire UI (HTML + CSS + JS in one file)
├── functions/
│   └── api/
│       └── ask.js      Cloudflare Pages Function — calls Claude, keeps the API key server-side
├── wrangler.toml
└── README.md
```

## What's in this version

- **One file for the UI.** `index.html` is the whole app front-end.
- **Animated sky**: a canvas layer adds twinkling stars at night, falling
  rain, or drifting snow depending on the actual current condition —
  plus soft drifting cloud silhouettes and a glowing sun on clear days.
- **Glass-panel gauges** for wind / air quality / rain with a subtle
  hover lift, animated needle and AQI arc fill.
- **Ask about your forecast**: a small chat box at the bottom. Ask things
  like *"should I carry an umbrella tomorrow?"* or *"is it a good evening
  for a run?"* — it answers strictly from the forecast data currently
  loaded (current conditions, next 24 hours, next 7 days), not as a
  general-purpose chatbot.
- Same data as before: temperature & feel, wind speed/direction/gusts,
  US AQI + PM2.5/PM10, rain now / next 12h / 7-day, hourly strip, °C/°F
  toggle, remembers your last city.
- Respects `prefers-reduced-motion` (particles and transitions freeze).

## Setting up the Q&A feature

The chat box calls `/api/ask`, a Cloudflare Pages Function that talks to
the Anthropic API. It needs an Anthropic API key, kept server-side as a
**secret** — it's never exposed to the browser.

1. Get an API key from the [Anthropic Console](https://console.anthropic.com/) if you don't have one.
2. After deploying (see below), set the secret:
   ```bash
   wrangler pages secret put ANTHROPIC_API_KEY --project-name skyline-weather
   ```
   (paste the key when prompted), or in the dashboard: your Pages project →
   **Settings** → **Environment variables** → add `ANTHROPIC_API_KEY` as
   a **Secret** (not plaintext), for both Production and Preview.
3. Redeploy if you added the secret via the dashboard mid-session — Pages
   picks it up on the next build/deploy automatically otherwise.

Without the key set, everything else in the app still works — the chat
box will just show a message saying the assistant isn't configured yet.

## Run it locally

The weather UI alone works by just double-clicking `index.html` (all
requests go to Open-Meteo over HTTPS) — but `/api/ask` only exists once
Pages Functions are running, so to test the chat box locally use:

```bash
npm install -g wrangler
wrangler pages dev . --compatibility-date=2026-01-01
# then set the secret for local dev too (one-time, stored in .dev.vars or passed via --binding):
echo "ANTHROPIC_API_KEY=sk-ant-..." > .dev.vars
```

## Deploy to Cloudflare Pages

**CLI:**
```bash
wrangler login
wrangler pages deploy .
wrangler pages secret put ANTHROPIC_API_KEY --project-name skyline-weather
```

**Dashboard (no CLI):** Cloudflare dashboard → Workers & Pages → Create →
Pages → Upload assets → drag in this whole folder, including the
`functions/` directory (that's what makes `/api/ask` work) → Deploy →
then add the `ANTHROPIC_API_KEY` secret under Settings → Environment
variables as described above.

You'll get a live `*.pages.dev` URL in seconds.
