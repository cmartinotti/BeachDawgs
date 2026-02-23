// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for Android emulator: Metro sends multipart/mixed responses with
// Transfer-Encoding: chunked which causes OkHttp to fail parsing chunk sizes.
// We intercept requests and strip "multipart/mixed" from the Accept header
// so Metro serves plain responses instead.
config.server = config.server || {};
const existingMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const enhanced = existingMiddleware
    ? existingMiddleware(metroMiddleware, server)
    : metroMiddleware;

  return (req, res, next) => {
    // Strip multipart/mixed from Accept header to prevent chunked multipart responses
    // that break OkHttp's chunked transfer encoding parser on Android
    if (req.headers && req.headers['accept']) {
      req.headers['accept'] = req.headers['accept']
        .split(',')
        .filter(t => !t.trim().startsWith('multipart/mixed'))
        .join(',');
    }
    return enhanced(req, res, next);
  };
};

module.exports = config;
