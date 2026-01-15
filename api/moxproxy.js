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
  const { path, ...rest } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path;

  const urlPath = (req.url.split('?')[0] || '').replace(/^\/api\/(moxproxy|moxapi)\/?/, '');
  const effectivePath = pathStr || urlPath;

  if (!effectivePath) {
    res.status(400).json({ error: 'Missing path. Example: /api/moxapi/v2/decks/all/<id>' });
    return;
  }

  const qs = new URLSearchParams(rest).toString();
  const base = upstreamBase.replace(/\/+$/, '');
  let cleanPath = effectivePath.replace(/^\/+/, '');
  if (base.endsWith('/v2') && cleanPath.startsWith('v2/')) {
    cleanPath = cleanPath.slice(3); // drop leading "v2" to avoid double v2/v2
  }
  const url = `${base}/${cleanPath}${qs ? `?${qs}` : ''}`;

  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': process.env.MOXFIELD_USER_AGENT || 'mtg-pod-randomizer/1.0',
    'accept-encoding': 'identity',
  };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await readBody(req);
  }

  try {
    const upstream = await fetch(url, init);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    const forwarded = {};
    upstream.headers.forEach((v, k) => {
      forwarded[k.toLowerCase()] = v;
    });
    delete forwarded['content-encoding'];
    delete forwarded['content-length'];
    Object.entries(forwarded).forEach(([k, v]) => res.setHeader(k, v));
    res.send(buf);
  } catch (e) {
    res.status(500).json({
      error: 'Proxy failed',
      detail: e?.message || 'unknown',
    });
  }
}

