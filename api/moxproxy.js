export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const upstreamBase = process.env.MOXFIELD_BASE_URL || 'https://api2.moxfield.com';

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  const { path } = req.query;
  if (!path) {
    res.status(400).json({ error: 'Missing path. Example: /api/moxproxy?path=v2/decks/all/<id>' });
    return;
  }

  const qsIndex = req.url.indexOf('&');
  const qs = qsIndex >= 0 ? req.url.slice(qsIndex).replace(/^&/, '?') : '';
  const url = `${upstreamBase}/${path}${qs}`;

  const headers = {
    accept: 'application/json',
    'user-agent': process.env.MOXFIELD_USER_AGENT || 'mtg-pod-randomizer/1.0',
  };
  if (process.env.MOXFIELD_API_KEY) headers['x-moxfield-key'] = process.env.MOXFIELD_API_KEY;
  if (process.env.MOXFIELD_COOKIE) headers.cookie = process.env.MOXFIELD_COOKIE;
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

  // Debug: append debug=1 to see target and headers.
  if (req.query.debug === '1') {
    res.status(200).json({ target: url, method: req.method, headers });
    return;
  }

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await readBody(req);
  }

  try {
    const upstream = await fetch(url, init);
    if (upstream.ok) {
      res.status(upstream.status);
      upstream.headers.forEach((v, k) => res.setHeader(k, v));
      upstream.body.pipe(res);
      return;
    }
    const text = await upstream.text();
    res.status(upstream.status).json({
      error: 'Upstream error',
      status: upstream.status,
      statusText: upstream.statusText,
      body: text?.slice(0, 500) || '',
    });
  } catch (e) {
    res.status(500).json({ error: 'Proxy failed', detail: e?.message || 'unknown' });
  }
}

