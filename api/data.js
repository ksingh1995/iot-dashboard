// Returns latest reading + history for the dashboard
// GET /api/data

const https = require('https');

const REPO   = 'ksingh1995/iot-dashboard';
const BRANCH = 'data';
const FILE   = 'iot-data.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function githubRequest(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.github.com',
      path,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'iot-dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({}); }
      });
    }).on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const file = await githubRequest(`/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`);
    if (file.content) {
      const data = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      return res.status(200).json({
        latest:  data.latest  || null,
        history: (data.history || []).slice(0, 50)
      });
    }
    return res.status(200).json({ latest: null, history: [] });
  } catch (err) {
    return res.status(200).json({ latest: null, history: [], error: err.message });
  }
};
