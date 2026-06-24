# Personal Fitness Dashboard

A personal fitness dashboard with gym tracking, health analytics, Garmin Connect sync, wellness check-in, recovery logging, and an AI coach. Fully self-deployable — your data lives in your own free Supabase database.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fagnewbros%2Fcharlie)

---

## Quick start (under 2 minutes)

1. Click **Deploy with Vercel** above → it forks the repo to your GitHub and deploys in one click
2. Visit your new URL → you'll land on the setup wizard automatically
3. Follow the 4 steps to connect your database and optionally Garmin + AI coach

---

## Supabase setup (required)

Your data lives in your own free Supabase project — Vercel doesn't store any of it.

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine)
2. In the **SQL editor**, paste the contents of [`supabase_schema.sql`](supabase_schema.sql) and click **Run** — this creates all required tables in one step
3. Go to **Project Settings → API** and copy your:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **Anon key** (starts with `eyJ...`)
4. Paste both into the setup wizard on your dashboard

---

## Garmin setup (optional)

Connects your Garmin watch to pull resting HR, sleep, Body Battery, stress, and activities automatically.

1. In your Vercel project → **Settings → Environment Variables**, add:
   - `GARMIN_EMAIL` = your Garmin account email
   - `GARMIN_PASSWORD` = your Garmin account password
2. Click **Redeploy** (takes ~30 seconds)
3. Open the setup wizard (⚙ top right) → Step 3 → tap **Test Garmin sync**

> Your Garmin credentials are stored as Vercel server-side environment variables. They never touch the browser or your Supabase database.

---

## AI coach setup (optional)

The Coach tab gives personalised answers based on your training data. It uses the Anthropic API — you need your own API key.

1. Get a free API key at [console.anthropic.com](https://console.anthropic.com)
2. Paste it into the setup wizard (⚙ top right) → Step 4
3. You **do not** need a Claude Pro subscription — you pay per use, and light coaching use costs fractions of a cent per session

> Your API key is stored only in your browser's localStorage. It is sent only to `api.anthropic.com` — never to any other server.

---

## Where your data lives

| Data | Stored in |
|---|---|
| Health & training data | Your Supabase database |
| Garmin credentials | Vercel environment variables (server-side only) |
| Supabase URL & anon key | Your browser's localStorage (safe to expose — anon key is scoped to your project) |
| Anthropic API key | Your browser's localStorage (sent only to Anthropic) |
| Display name | Your browser's localStorage |

---

## Pages

| File | What it is |
|---|---|
| `index.html` | Goals tracker — Day Ring, Goal Ticker, To Do list |
| `gym.html` | Gym tracker — quick workout logger, exercise history |
| `health.html` | Daily supplement / stack tracker |
| `performance.html` | Intel — Strength, Health, Activities, Wellness, Recovery, Insights, Coach tabs |
| `finance.html` | Finance tracker |
| `setup.html` | First-run setup wizard (re-open via ⚙ in the top bar) |

---

## No build step

Open any `.html` file directly in a browser or deploy to Vercel as-is. No npm, no bundler, no install required.
