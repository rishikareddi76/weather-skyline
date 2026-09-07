# Skyline — weather station (single file + AI Q&A)

## 🔗 Working links

- **Live app:** https://skyline-weather.pages.dev
- **GitHub repo:** https://github.com/rishikareddi76/weather-skyline

The UI — markup, styling, and logic — lives in one file: `index.html`.
Weather data comes from the free, keyless [Open-Meteo](https://open-meteo.com)
API. One small serverless function (`functions/api/ask.js`) adds a chat box
that answers questions about the current forecast using AI.

```
weather-app-single/
├── index.html          the entire UI (HTML + CSS + JS in one file)
├── functions/
│   └── api/
│       └── ask.js      Cloudflare Pages Function — answers forecast questions via AI
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

The chat box calls `/api/ask`, a Cloudflare Pages Function that answers
forecast questions with one of three AI providers, chosen by the
`AI_PROVIDER` environment variable. Keys (if any) stay server-side as
Pages **secrets** — never exposed to the browser.

| Provider | `AI_PROVIDER` | Requires | Cost |
|---|---|---|---|
| **Cloudflare Workers AI** (default) | `workers-ai` | the `[ai]` binding in `wrangler.toml` | free tier, no key |
| **Google Gemini** | `gemini` | `GEMINI_API_KEY` secret | free tier |
| **Anthropic** | `anthropic` | `ANTHROPIC_API_KEY` secret | paid |

Without `AI_PROVIDER` set, the function picks Workers AI automatically if
the binding exists, then Gemini, then Anthropic. If nothing is configured,
everything else in the app still works — the chat box just shows a message
saying the assistant isn't configured yet.

## Run it locally

The weather UI alone works by just double-clicking `index.html` (all
requests go to Open-Meteo over HTTPS) — but `/api/ask` only exists once
Pages Functions are running, so to test the chat box locally use:

```bash
npm install -g wrangler
wrangler pages dev . --compatibility-date=2026-01-01 --port 8788
# optional, for the chat in local dev (one-time; never commit .dev.vars):
echo "AI_PROVIDER=gemini
GEMINI_API_KEY=your-key" > .dev.vars
```

Note: with the `[ai]` binding present, `wrangler pages dev` runs in remote
mode and needs a registered workers.dev subdomain (`wrangler subdomain` via
the dashboard onboarding).

## Deploy to Cloudflare Pages

**CLI:**
```bash
wrangler login
wrangler pages deploy .
# optional, to switch providers or enable Gemini/Anthropic:
wrangler pages secret put AI_PROVIDER --project-name skyline-weather   # e.g. gemini
wrangler pages secret put GEMINI_API_KEY --project-name skyline-weather
```

**Dashboard (no CLI):** Cloudflare dashboard → Workers & Pages → Create →
Pages → Upload assets → drag in this whole folder, including the
`functions/` directory (that's what makes `/api/ask` work) → Deploy →
then add any secrets under Settings → Environment variables as described
above.

You'll get a live `*.pages.dev` URL in seconds.
