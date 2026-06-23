const { GarminConnect } = require('garmin-connect');

const MCP = 'https://garmin.amalgama.co/api/v1/mcp/7e260090-9ba6-4724-8027-f39f31549796';
const GC_API = 'https://connectapi.garmin.com';

let _cache = { data: null, ts: 0 };
const CACHE_MS = 10 * 60 * 1000;

let _gc = null;
let _gcTs = 0;

async function getGC() {
  if (!_gc || Date.now() - _gcTs > 50 * 60 * 1000) {
    _gc = new GarminConnect({
      username: process.env.GARMIN_EMAIL,
      password: process.env.GARMIN_PASSWORD,
    });
    await _gc.login();
    _gcTs = Date.now();
  }
  return _gc;
}

async function mcpTool(name, args) {
  const r = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args || {} } }),
  });
  const j = await r.json();
  const text = j?.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : null;
}

function val(r) { return r.status === 'fulfilled' ? r.value : null; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');

  const bust = req.query && req.query.bust;
  if (!bust && _cache.data && Date.now() - _cache.ts < CACHE_MS) {
    return res.json({ ..._cache.data, cached: true });
  }

  const activitiesP = mcpTool('list_activities', { limit: 5 }).catch(() => []);

  let wellness = {};
  const hasEnv = !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD);
  if (hasEnv) {
    try {
      const gc = await getGC();
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const profile = await gc.getUserProfile().catch(() => ({}));
      const dn = profile?.displayName || profile?.userName || profile?.userProfileId || '';

      const [hrR, sleepR, hrvR, stressR, bbR] = await Promise.allSettled([
        gc.getHeartRate(today),
        gc.getSleepData(today),
        gc.get(`${GC_API}/hrv-service/hrv/${dn}?startDate=${dateStr}&endDate=${dateStr}`),
        gc.get(`${GC_API}/stress-service/stress/summaryDetails/${dn}?startDate=${dateStr}&endDate=${dateStr}`),
        gc.get(`${GC_API}/wellness-service/wellness/dailySummaryChart/${dn}?date=${dateStr}`),
      ]);

      const hr  = val(hrR)     || {};
      const sl  = val(sleepR)  || {};
      const hv  = val(hrvR)    || {};
      const st  = val(stressR) || {};
      const bb  = val(bbR);

      const sleepSec = sl?.dailySleepDTO?.sleepTimeSeconds ?? sl?.sleepTimeSeconds ?? null;

      // Body battery: daily chart returns array; grab latest non-null value
      let bodyBattery = null;
      if (Array.isArray(bb)) {
        for (let i = bb.length - 1; i >= 0; i--) {
          if (bb[i]?.bodyBattery != null) { bodyBattery = bb[i].bodyBattery; break; }
          if (bb[i]?.value != null)        { bodyBattery = bb[i].value; break; }
        }
      }

      wellness = {
        body_battery: bodyBattery,
        resting_hr:   hr?.restingHeartRate ?? null,
        hrv:          hv?.hrvSummary?.lastNight ?? hv?.lastNight ?? hv?.weeklyAvg ?? null,
        stress:       st?.overallStressLevel ?? st?.avgStressLevel ?? null,
        sleep:        sleepSec != null ? Math.round(sleepSec / 360) / 10 : null,
        _dn:          dn,
        _raw: {
          hv_keys:  hv  ? Object.keys(hv)  : null,
          st_keys:  st  ? Object.keys(st)  : null,
          bb_sample: Array.isArray(bb) ? bb.slice(-3) : bb,
          profile_keys: profile ? Object.keys(profile) : null,
          profile_dn:   profile?.displayName,
          profile_un:   profile?.userName,
        },
      };
    } catch (e) { wellness = { _error: e.message }; }
  }

  const activities = await activitiesP;
  const data = { wellness, hasEnv, activities: Array.isArray(activities) ? activities : [] };
  _cache = { data, ts: Date.now() };
  res.json({ ...data, cached: false });
};
