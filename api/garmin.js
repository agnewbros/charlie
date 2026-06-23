const MCP = 'https://garmin.amalgama.co/api/v1/mcp/7e260090-9ba6-4724-8027-f39f31549796';

let _cache = { data: null, ts: 0 };
const CACHE_MS = 10 * 60 * 1000;

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

function settled(r) { return r.status === 'fulfilled' ? r.value : null; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');

  const bust = req.query && req.query.bust;
  if (!bust && _cache.data && Date.now() - _cache.ts < CACHE_MS) {
    return res.json({ ..._cache.data, cached: true });
  }

  const [actsR, bbR, sleepR, hrvR, stressR, snapR] = await Promise.allSettled([
    mcpTool('list_activities', { limit: 5 }),
    mcpTool('get_body_battery', {}),
    mcpTool('get_sleep_summary', {}),
    mcpTool('get_hrv_status', {}),
    mcpTool('get_stress', {}),
    mcpTool('get_wellness_snapshot', {}),
  ]);

  const bb   = settled(bbR);
  const sl   = settled(sleepR);
  const hv   = settled(hrvR);
  const st   = settled(stressR);
  const snap = settled(snapR);
  const acts = settled(actsR);

  const sleepSec = sl?.sleepTimeSeconds ?? sl?.totalSleepSeconds ?? sl?.dailySleepDTO?.sleepTimeSeconds ?? null;

  const wellness = {
    body_battery: bb?.currentBodyBattery ?? bb?.bodyBattery ?? snap?.bodyBattery ?? null,
    resting_hr:   snap?.restingHeartRate ?? snap?.resting_heart_rate ?? null,
    hrv:          hv?.lastNight ?? hv?.hrv ?? hv?.weeklyAvg ?? snap?.hrv ?? null,
    stress:       st?.overallStressLevel ?? st?.avgStressLevel ?? snap?.stress ?? null,
    sleep:        sleepSec != null ? Math.round(sleepSec / 360) / 10 : null,
    _raw: { bb, sl, hv, st, snap },
  };

  const data = { wellness, activities: Array.isArray(acts) ? acts : [] };
  _cache = { data, ts: Date.now() };
  res.json({ ...data, cached: false });
};
