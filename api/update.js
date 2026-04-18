// IoT Data Receiver — matches ThingSpeak URL format exactly
// GET /api/update?api_key=XXX&field1=TEMP&field2=HUMIDITY
//
// To migrate from ThingSpeak: just change server[] in Arduino code from
// "api.thingspeak.com" → "your-app.vercel.app"

const fs = require('fs');

const DATA_FILE = '/tmp/iot-data.json';
const MAX_HISTORY = 100;

const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function saveToKV(reading) {
  const { kv } = await import('@vercel/kv');
  await kv.set('latest', reading);
  await kv.lpush('history', JSON.stringify(reading));
  await kv.ltrim('history', 0, MAX_HISTORY - 1);
  return await kv.llen('history');
}

function saveToFile(reading) {
  let data = { latest: null, history: [] };
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (_) {}

  data.latest = reading;
  data.history.unshift(reading);
  if (data.history.length > MAX_HISTORY) data.history = data.history.slice(0, MAX_HISTORY);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
  return data.history.length;
}

module.exports = async function handler(req, res) {
  const { api_key, field1, field2 } = req.query;

  // Validate API key
  const expectedKey = process.env.API_KEY || 'AYKELL4MXR7ZIIEM';
  if (api_key !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const temp = parseFloat(field1);
  const hum  = parseFloat(field2);

  if (isNaN(temp) || isNaN(hum)) {
    return res.status(400).json({ error: 'Invalid sensor data', field1, field2 });
  }

  const reading = {
    temp: Math.round(temp * 10) / 10,
    hum:  Math.round(hum  * 10) / 10,
    timestamp: new Date().toISOString()
  };

  try {
    const entryId = HAS_KV ? await saveToKV(reading) : saveToFile(reading);

    // ThingSpeak-compatible response — Arduino code expects this format
    return res.status(200).json({
      entry_id:   entryId,
      channel_id: 1,
      created_at: reading.timestamp,
      field1:     reading.temp,
      field2:     reading.hum
    });
  } catch (err) {
    console.error('Save error:', err);
    return res.status(500).json({ error: 'Storage error', detail: err.message });
  }
};
