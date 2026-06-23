const { GarminConnect } = require('garmin-connect');

const MCP     = 'https://garmin.amalgama.co/api/v1/mcp/7e260090-9ba6-4724-8027-f39f31549796';
const GC_API  = 'https://connectapi.garmin.com';
const PROXY   = 'https://connect.garmin.com/modern/proxy';
const SSO_SVC = 'https://connect.garmin.com/modern/';
const UA      = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

let _cache  = { data: null, ts: 0 };
const CACHE_MS = 10 * 60 * 1000;

let _gc    = null;
let _gcTs  = 0;
let _hvJar = null;
let _hvJarTs = 0;

async function getGC() {
  if (!_gc || Date.now() - _gcTs > 50 * 60 * 1000) {
    _gc = new GarminConnect({ username: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD });
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

function parseCookies(response, jar) {
  const fn = response.headers.getSetCookie;
  const raw = typeof fn === 'function' ? fn.call(response.headers) : [response.headers.get('set-cookie') || ''];
  raw.forEach(c => {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  });
}

function cookieHdr(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function ssoLogin(email, password) {
  const jar = {};
  const signinUrl = `https://sso.garmin.com/sso/signin?service=${encodeURIComponent(SSO_SVC)}&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&locale=en_US`;

  // Step 1: GET signin page — real HTML form with CSRF token
  const r1 = await fetch(signinUrl, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
  parseCookies(r1, jar);
  const html = await r1.text();
  const csrf = (html.match(/name="_csrf"\s+value="([^"]+)"/) || html.match(/"_csrf"\s*:\s*"([^"]+)"/) || [])[1];
  if (!csrf) return { err: 'no_csrf' };

  // Step 2: POST credentials + CSRF
  const r2 = await fetch(signinUrl, {
    method: 'POST', redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHdr(jar),
      'User-Agent': UA,
      'Origin': 'https://sso.garmin.com',
      'Referer': signinUrl,
    },
    body: new URLSearchParams({ username: email, password, _csrf: csrf, embed: 'false' }).toString(),
  });
  parseCookies(r2, jar);

  const loc1 = r2.headers.get('location');
  if (!loc1) return { err: 'no_redirect', status: r2.status };

  // Step 3: follow redirect(s) until we land on connect.garmin.com (session cookies set here)
  let loc = loc1;
  for (let i = 0; i < 4 && loc; i++) {
    const r = await fetch(loc, { redirect: 'manual', headers: { 'Cookie': cookieHdr(jar), 'User-Agent': UA } });
    parseCookies(r, jar);
    loc = r.headers.get('location');
  }

  return { ok: true, jar };
}

async function getHRVJar() {
  if (_hvJar && Date.now() - _hvJarTs < 55 * 60 * 1000) return { ok: true, jar: _hvJar };
  const result = await ssoLogin(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
  if (result.ok) { _hvJar = result.jar; _hvJarTs = Date.now(); }
  return result;
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
      const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const profile = await gc.getUserProfile().catch(() => ({}));
      const dn = profile?.displayName || '';

      const [summaryR, sleepR] = await Promise.allSettled([
        gc.get(`${GC_API}/usersummary-service/usersummary/daily/${dn}?calendarDate=${dateStr}`),
        gc.getSleepData(today),
      ]);

      const su = val(summaryR) || {};
      const sl = val(sleepR)   || {};
      const sleepSec = sl?.dailySleepDTO?.sleepTimeSeconds ?? sl?.sleepTimeSeconds ?? null;

      // HRV via cookie-based SSO login → proxy endpoint
      let hrv = null;
      let hvDebug = {};
      try {
        const jarResult = await getHRVJar();
        if (jarResult.ok) {
          const cookie = cookieHdr(jarResult.jar);
          const r = await fetch(`${PROXY}/hrv-service/hrv/${dn}?startDate=${weekAgo}&endDate=${dateStr}`, {
            headers: { 'Cookie': cookie, 'Accept': 'application/json', 'NK': 'NT', 'User-Agent': UA }
          });
          const text = await r.text();
          hvDebug = { status: r.status, ct: r.headers.get('content-type'), sample: text.slice(0, 300), cookieCount: Object.keys(jarResult.jar).length };
          if (r.ok && text.trimStart().startsWith('{')) {
            const hv = JSON.parse(text);
            if (Array.isArray(hv?.hrv) && hv.hrv.length) {
              for (let i = hv.hrv.length - 1; i >= 0; i--) {
                const s = hv.hrv[i]?.hrvSummary;
                if (s?.lastNight != null) { hrv = s.lastNight; break; }
                if (s?.weeklyAvg  != null) { hrv = s.weeklyAvg;  break; }
              }
            }
          }
        } else {
          hvDebug = jarResult;
        }
      } catch (e) { hvDebug = { err: e.message }; }

      wellness = {
        body_battery: su?.bodyBatteryMostRecentValue ?? null,
        resting_hr:   su?.restingHeartRate ?? null,
        hrv,
        stress:       su?.averageStressLevel ?? null,
        sleep:        sleepSec != null ? Math.round(sleepSec / 360) / 10 : null,
        _hv_debug:    hvDebug,
      };
    } catch (e) { wellness = { _error: e.message }; }
  }

  const activities = await activitiesP;
  const data = { wellness, activities: Array.isArray(activities) ? activities : [] };
  _cache = { data, ts: Date.now() };
  res.json({ ...data, cached: false });
};
