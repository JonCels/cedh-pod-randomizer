export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const deckId = req.query.deckId;
  const apiKey = process.env.MOXFIELD_API_KEY;
  const userAgent = process.env.MOXFIELD_USER_AGENT;
  const baseUrl = process.env.MOXFIELD_BASE_URL || 'https://api2.moxfield.com/v2';
  const keyHeader = process.env.MOXFIELD_KEY_HEADER || 'X-Moxfield-Key';

  if (!deckId) {
    return res.status(400).json({ error: 'deckId is required' });
  }

  if (!userAgent) {
    return res.status(500).json({ error: 'Server missing MOXFIELD_USER_AGENT' });
  }

  try {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    };
    if (apiKey) {
      headers[keyHeader] = apiKey;
    }

    const upstream = await fetch(`${baseUrl}/decks/all/${encodeURIComponent(deckId)}`, {
      method: 'GET',
      headers,
    });

    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.status(upstream.status).send(text);
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Moxfield proxy failed', detail: err.message });
  }
}

