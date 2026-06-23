const { GarminConnect } = require('garmin-connect');

const MCP = 'https://garmin.amalgama.co/api/v1/mcp/7e260090-9ba6-4724-8027-f39f31549796';

let _cache = { data: null, ts: 0 };
const CACHE_MS = 10 * 60 * 1000;

let _gc = null;
let _gcTs = 0;

async function getGC() {
  if (!_gc || Date.now() - _gcTs > 50 * 60 * 1000) {
    _gc = new GarminConnect();
    await _gc.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
    _gcTs = Date.now();
  }
  return _gc;
}

async function mcpTool(name, args) {
  const r = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args || {} } })
  });
  const j = await r.json();
  const text = j?.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : null;
}

function val(r) { return r.status === 'fulfilled' ? r.value : null; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');

  if (_cache.data && Date.now() - _cache.ts < CACHE_MS) {
    return res.json({ ..._cache.data, cached: true });
  }

  // Activities always come from MCP (no auth needed)
  const activitiesP = mcpTool('list_activities', { limit: 5 }).catch(() => []);

  // Wellness from garmin-connect (requires env vars)
  let wellness = {};
  if (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) {
    try {
      const gc = await getGC();
      const today = new Date();
      const [summaryR, hrvR, stressR, sleepR] = await Promise.allSettled([
        gc.getUserSummary(today),
        gc.getHRV(today),
        gc.getStress(today),
        gc.getSleep(today),
      ]);
      const s  = val(summaryR) || {};
      const h  = val(hrvR)     || {};
      const st = val(stressR)  || {};
      const sl = val(sleepR)   || {};

      const sleepSec = sl?.dailySleepDTO?.sleepTimeSeconds ?? sl?.sleepTimeSeconds ?? null;
      wellness = {
        resting_hr: s?.restingHeartRate ?? null,
        hrv:        h?.hrvSummary?.lastNight ?? h?.lastNight ?? h?.weeklyAvg ?? null,
        stress:     st?.overallStressLevel ?? st?.avgStressLevel ?? null,
        sleep:      sleepSec != null ? Math.round(sleepSec / 360) / 10 : null,
      };
    } catch (_) {}
  }

  const activities = await activitiesP;
  const data = { wellness, activities: Array.isArray(activities) ? activities : [] };
  _cache = { data, ts: Date.now() };
  res.json({ ...data, cached: false });
};
