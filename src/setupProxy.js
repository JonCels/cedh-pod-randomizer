const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/edhapi',
    createProxyMiddleware({
      target: 'https://edhtop16.com',
      changeOrigin: true,
      pathRewrite: { '^/edhapi': '/api' },
      cookieDomainRewrite: 'localhost', // allow CF cookies when proxied via localhost
    })
  );

  // Dev-time proxy for Moxfield to avoid CORS. In prod (Vercel), set up an equivalent
  // serverless proxy/rewrite with the same headers.
  app.use(
    ['/api/moxapi', '/moxapi'],
    createProxyMiddleware({
      target: 'https://api2.moxfield.com',
      changeOrigin: true,
      pathRewrite: (path) =>
        path.replace(/^\/api\/moxapi/, '').replace(/^\/moxapi/, ''),
      onProxyReq: (proxyReq) => {
        const ua = process.env.MOXFIELD_USER_AGENT || 'mtg-pod-randomizer/1.0';
        proxyReq.setHeader('user-agent', ua);
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('content-type', 'application/json');
        if (process.env.MOXFIELD_API_KEY) {
          proxyReq.setHeader('x-moxfield-key', process.env.MOXFIELD_API_KEY);
        }
        if (process.env.MOXFIELD_COOKIE) {
          proxyReq.setHeader('cookie', process.env.MOXFIELD_COOKIE);
        }
      },
    })
  );
};