// IoT Data Receiver — matches ThingSpeak URL format exactly
// GET /api/update?api_key=XXX&field1=TEMP&field2=HUMIDITY

const https = require('https');

const MAX_HISTORY = 100;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'ksingh1995/iot-dashboard';
const BRANCH = 'data';
const FILE = 'iot-data.json';

// GitHub API helper
function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'iot-dashboard',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function saveToGitHub(reading) {
  // Get current file (need SHA to update)
  const existing = await githubRequest('GET', `/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`);

  let store = { latest: null, history: [] };
  if (existing.content) {
    try {
      store = JSON.parse(Buffer.from(existing.content, 'base64').toString('utf8'));
    } catch (_) {}
  }

  store.latest = reading;
  store.history.unshift(reading);
  if (store.history.length > MAX_HISTORY) store.history = store.history.slice(0, MAX_HISTORY);

  const content = Buffer.from(JSON.stringify(store)).toString('base64');
  await githubRequest('PUT', `/repos/${REPO}/contents/${FILE}`, {
    message: `IoT update: ${reading.temp}°C / ${reading.hum}%`,
    content,
    sha: existing.sha,
    branch: BRANCH
  });

  return store.history.length;
}

module.exports = async function handler(req, res) {
  const { api_key, field1, field2 } = req.query;

  const expectedKey = process.env.API_KEY || 'AYKELL4MXR7ZIIEM';
  if (api_key !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const temp = parseFloat(field1);
  const hum  = parseFloat(field2);
  if (isNaN(temp) || isNaN(hum)) {
    return res.status(400).json({ error: 'Invalid sensor data' });
  }

  const reading = {
    temp: Math.round(temp * 10) / 10,
    hum:  Math.round(hum  * 10) / 10,
    timestamp: new Date().toISOString()
  };

  try {
    const entryId = await saveToGitHub(reading);
    return res.status(200).json({
      entry_id: entryId,
      channel_id: 1,
      created_at: reading.timestamp,
      field1: reading.temp,
      field2: reading.hum
    });
  } catch (err) {
    console.error('Save error:', err);
    return res.status(500).json({ error: 'Storage error', detail: err.message });
  }
};
