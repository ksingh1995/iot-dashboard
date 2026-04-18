// Returns latest reading + history for the dashboard
// GET /api/data

import fs from 'fs';

const DATA_FILE = '/tmp/iot-data.json';
const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function readFromKV() {
  const { kv } = await import('@vercel/kv');
  const latest = await kv.get('latest');
  const raw = await kv.lrange('history', 0, 49);
  const history = raw.map(h => (typeof h === 'string' ? JSON.parse(h) : h));
  return { latest, history };
}

function readFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return { latest: data.latest, history: (data.history || []).slice(0, 50) };
    }
  } catch (_) {}
  return { latest: null, history: [] };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const data = HAS_KV ? await readFromKV() : readFromFile();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Read error:', err);
    return res.status(200).json({ latest: null, history: [], error: err.message });
  }
}
