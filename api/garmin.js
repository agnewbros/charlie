// Vercel serverless function — proxies Garmin Connect data.
// Required env vars (set in Vercel dashboard):
//   GARMIN_EMAIL    — your Garmin Connect email
//   GARMIN_PASSWORD — your Garmin Connect password
//
// Returns JSON: { steps, hr, hrv, sleep, date, cached }

const { GarminConnect } = require('garmin-connect');

// Module-level cache: stays warm across invocations in the same container.
let _cache = { data: null, ts: 0 };
const CACHE_MS = 15 * 60 * 1000; // 15 minutes

function safe(result) {
  return result.status === 'fulfilled' ? result.value : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=60');

  // Return cached data if fresh
  if (_cache.data && Date.now() - _cache.ts < CACHE_MS) {
    return res.json({ ..._cache.data, cached: true });
  }

  if (!process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD) {
    return res.status(500).json({ error: 'GARMIN_EMAIL / GARMIN_PASSWORD env vars not set' });
  }

  try {
    const gc = new GarminConnect();
    await gc.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);

    const today = new Date();

    const [summaryRes, hrRes, sleepRes, hrvRes] = await Promise.allSettled([
      gc.getUserSummary(today),
      gc.getHeartRate(today),
      gc.getSleep(today),
      gc.getHRV(today),
    ]);

    const summary = safe(summaryRes) || {};
    const hr      = safe(hrRes)      || {};
    const sleep   = safe(sleepRes)   || {};
    const hrv     = safe(hrvRes)     || {};

    // Steps — field varies by API version
    const steps = summary.totalSteps ?? summary.steps ?? null;

    // Resting heart rate
    const heartRate = hr.restingHeartRate ?? hr.resting ?? null;

    // HRV (ms) — field varies
    const hrvVal =
      hrv?.hrvSummary?.lastNight ??
      hrv?.lastNight ??
      hrv?.weeklyAvg ??
      null;

    // Sleep in hours
    const sleepSec =
      sleep?.dailySleepDTO?.sleepTimeSeconds ??
      sleep?.sleepTimeSeconds ??
      null;
    const sleepHours = sleepSec != null ? Math.round(sleepSec / 360) / 10 : null;

    const date = today.toISOString().slice(0, 10);
    const data = { steps, hr: heartRate, hrv: hrvVal, sleep: sleepHours, date };

    _cache = { data, ts: Date.now() };
    res.json({ ...data, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
