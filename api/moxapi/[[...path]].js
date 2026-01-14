export const config = {
    api: { bodyParser: false, externalResolver: true },
  };
  
  const upstreamBase = process.env.MOXFIELD_BASE_URL || 'https://api2.moxfield.com';
  
  export default async function handler(req, res) {
    const path = (req.query.path || []).join('/');
    const qsIndex = req.url.indexOf('?');
    const qs = qsIndex >= 0 ? req.url.slice(qsIndex) : '';
    const url = `${upstreamBase}/${path}${qs}`;
  
    const headers = {
      accept: 'application/json',
      'user-agent': process.env.MOXFIELD_USER_AGENT || 'mtg-pod-randomizer/1.0',
    };
    if (process.env.MOXFIELD_API_KEY) headers['x-moxfield-key'] = process.env.MOXFIELD_API_KEY;
    if (process.env.MOXFIELD_COOKIE) headers.cookie = process.env.MOXFIELD_COOKIE;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  
    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      init.body = Buffer.concat(chunks);
    }
  
    try {
      const upstream = await fetch(url, init);
      res.status(upstream.status);
      upstream.headers.forEach((v, k) => res.setHeader(k, v));
      upstream.body.pipe(res);
    } catch (e) {
      res.status(500).json({ error: 'Proxy failed', detail: e?.message || 'unknown' });
    }
  }