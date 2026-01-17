export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const upstreamBase = process.env.TOPDECK_BASE_URL || 'https://topdeck.gg/api';

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  const { path, ...rest } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path;

  const urlPath = (req.url.split('?')[0] || '').replace(/^\/api\/topdeck(?:proxy)?\/?/, '');
  const effectivePath = pathStr || urlPath;

  if (!effectivePath) {
    res.status(400).json({
      error: 'Missing path. Example: /api/topdeck/v2/tournaments/<id>/players/<id>',
    });
    return;
  }

  const qs = new URLSearchParams(rest).toString();
  const base = upstreamBase.replace(/\/+$/, '');
  const cleanPath = effectivePath.replace(/^\/+/, '');
  const url = `${base}/${cleanPath}${qs ? `?${qs}` : ''}`;

  const headers = {
    accept: 'application/json',
    'accept-encoding': 'identity',
  };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (process.env.TOPDECK_API_KEY) {
    headers.authorization = process.env.TOPDECK_API_KEY;
  }

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
      error: 'TopDeck proxy failed',
      detail: e?.message || 'unknown',
    });
  }
}
