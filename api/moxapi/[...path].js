export const config = {
  api: {
    bodyParser: false, // we stream bodies through
  },
};

const defaultBase = 'https://api2.moxfield.com';

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  const { path = [] } = req.query;
  const segs = Array.isArray(path) ? path : [path];
  const qsIndex = req.url.indexOf('?');
  const qs = qsIndex >= 0 ? req.url.slice(qsIndex) : '';
  const upstreamBase = process.env.MOXFIELD_BASE_URL || defaultBase;
  const targetUrl = `${upstreamBase}/${segs.join('/')}${qs}`;

  const headers = {
    accept: 'application/json',
    'user-agent': process.env.MOXFIELD_USER_AGENT || 'mtg-pod-randomizer/1.0',
  };
  if (process.env.MOXFIELD_API_KEY) headers['x-moxfield-key'] = process.env.MOXFIELD_API_KEY;
  if (process.env.MOXFIELD_COOKIE) headers.cookie = process.env.MOXFIELD_COOKIE;
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await readBody(req);
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const text = await upstream.text();
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: 'Proxy failed', detail: e?.message || 'unknown' });
  }
}

