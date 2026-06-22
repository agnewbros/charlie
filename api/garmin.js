const MCP = 'https://garmin.amalgama.co/api/v1/mcp/7e260090-9ba6-4724-8027-f39f31549796';

let _cache = { data: null, ts: 0 };
const CACHE_MS = 10 * 60 * 1000;

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');

  if (_cache.data && Date.now() - _cache.ts < CACHE_MS) {
    return res.json({ ..._cache.data, cached: true });
  }

  try {
    const [wellness, activities] = await Promise.all([
      mcpTool('get_wellness_snapshot'),
      mcpTool('list_activities', { limit: 5 }),
    ]);

    const data = {
      wellness: wellness || {},
      activities: Array.isArray(activities) ? activities : [],
    };

    _cache = { data, ts: Date.now() };
    res.json({ ...data, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
