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
  if (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) {
    try {
      const gc = await getGC();
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const profile = await gc.getUserProfile().catch(() => ({}));
      const dn = profile?.displayName || '';

      const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [summaryR, sleepR] = await Promise.allSettled([
        gc.get(`${GC_API}/usersummary-service/usersummary/daily/${dn}?calendarDate=${dateStr}`),
        gc.getSleepData(today),
      ]);

      const su = val(summaryR) || {};
      const sl = val(sleepR)   || {};
      const sleepSec = sl?.dailySleepDTO?.sleepTimeSeconds ?? sl?.sleepTimeSeconds ?? null;

      const uid = su?.userProfileId || '';
      let hv = null, hvErr = [];
      const hrvUrls = [
        `${GC_API}/hrv-service/hrv/${uid}?startDate=${weekAgo}&endDate=${dateStr}`,
        `${GC_API}/hrv-service/hrv/daily/${dn}?calendarDate=${dateStr}`,
        `${GC_API}/hrv-service/hrv/status/${dn}?startDate=${weekAgo}&endDate=${dateStr}`,
        `${GC_API}/hrv-service/hrv?startDate=${weekAgo}&endDate=${dateStr}`,
      ];
      for (const url of hrvUrls) {
        try {
          const res = await gc.get(url);
          if (res && typeof res === 'object' && !Array.isArray(res) &&
              (Array.isArray(res.hrv) ? res.hrv.length : Object.keys(res).length > 0)) {
            hv = res; break;
          }
        } catch (e) { hvErr.push(url.replace(GC_API, '') + ': ' + e.message.slice(0, 80)); }
      }

      // HRV: find most recent lastNight value
      let hrv = null;
      if (Array.isArray(hv?.hrv) && hv.hrv.length) {
        for (let i = hv.hrv.length - 1; i >= 0; i--) {
          const s = hv.hrv[i]?.hrvSummary;
          if (s?.lastNight != null) { hrv = s.lastNight; break; }
          if (s?.weeklyAvg  != null) { hrv = s.weeklyAvg;  break; }
        }
      } else if (hv?.hrvSummary) {
        hrv = hv.hrvSummary?.lastNight ?? hv.hrvSummary?.weeklyAvg ?? null;
      }

      wellness = {
        body_battery: su?.bodyBatteryMostRecentValue ?? null,
        resting_hr:   su?.restingHeartRate ?? null,
        hrv,
        stress:       su?.averageStressLevel ?? null,
        sleep:        sleepSec != null ? Math.round(sleepSec / 360) / 10 : null,
        _hv_debug:    { hv: hv ? Object.keys(hv) : null, hvErr },
      };
    } catch (e) { wellness = { _error: e.message }; }
  }

  const activities = await activitiesP;
  const data = { wellness, activities: Array.isArray(activities) ? activities : [] };
  _cache = { data, ts: Date.now() };
  res.json({ ...data, cached: false });
};
