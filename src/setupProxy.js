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
};