'use strict';

const COLORS = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',

  black:   '\x1b[30m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',

  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue:  '\x1b[44m',
};

function statusColor(code) {
  if (code >= 500) return COLORS.red;
  if (code >= 400) return COLORS.yellow;
  if (code >= 300) return COLORS.cyan;
  if (code >= 200) return COLORS.green;
  return COLORS.white;
}

function methodColor(method) {
  const map = {
    GET:    COLORS.green,
    POST:   COLORS.blue,
    PUT:    COLORS.yellow,
    PATCH:  COLORS.magenta,
    DELETE: COLORS.red,
    HEAD:   COLORS.cyan,
    OPTIONS: COLORS.white,
  };
  return map[method] || COLORS.white;
}

function pad(str, length) {
  return String(str).padEnd(length);
}

function formatDuration(ms) {
  if (ms < 1)    return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

const DEFAULTS = {
  format: 'text',
  colors: true,
  stream: process.stdout,
  skip: null,
  logBodySize: true,
  logUserAgent: false,
  prefix: '',
  tokens: {},
  formatFn: null,
};

function formatText(req, res, duration, options) {
  const useColor = options.colors && options.stream.isTTY !== false;

  const ts   = useColor ? `${COLORS.dim}${timestamp()}${COLORS.reset}` : timestamp();
  const mCol = useColor ? methodColor(req.method) : '';
  const sCol = useColor ? statusColor(res.statusCode) : '';
  const rst  = useColor ? COLORS.reset : '';
  const dim  = useColor ? COLORS.dim : '';
  const bold = useColor ? COLORS.bold : '';

  const method  = `${mCol}${bold}${pad(req.method, 7)}${rst}`;
  const route   = `${bold}${req.originalUrl || req.url}${rst}`;
  const status  = `${sCol}${bold}${res.statusCode}${rst}`;
  const elapsed = `${dim}${formatDuration(duration)}${rst}`;

  let line = `${ts}  ${method} ${route}  →  ${status}  ${elapsed}`;

  if (options.logBodySize) {
    const size = res.getHeader('content-length');
    if (size) line += `  ${dim}${size}b${rst}`;
  }

  if (options.logUserAgent) {
    const ua = req.headers['user-agent'];
    if (ua) line += `\n           ${dim}${ua}${rst}`;
  }

  if (options.prefix) line = `[${options.prefix}] ${line}`;

  return line;
}

function formatJSON(req, res, duration) {
  const entry = {
    timestamp: new Date().toISOString(),
    method:    req.method,
    url:       req.originalUrl || req.url,
    status:    res.statusCode,
    duration:  parseFloat(duration.toFixed(2)),
    durationUnit: 'ms',
    ip:        req.ip || req.connection?.remoteAddress,
  };

  const size = res.getHeader('content-length');
  if (size) entry.responseSize = parseInt(size, 10);

  const ua = req.headers['user-agent'];
  if (ua) entry.userAgent = ua;

  return JSON.stringify(entry);
}

function formatCombined(req, res, duration) {
  const ip      = req.ip || req.connection?.remoteAddress || '-';
  const ts      = new Date().toUTCString();
  const method  = req.method;
  const url     = req.originalUrl || req.url;
  const proto   = `HTTP/${req.httpVersion}`;
  const status  = res.statusCode;
  const size    = res.getHeader('content-length') || '-';
  const referer = req.headers['referer'] || '-';
  const ua      = req.headers['user-agent'] || '-';

  return `${ip} - - [${ts}] "${method} ${url} ${proto}" ${status} ${size} "${referer}" "${ua}" ${duration.toFixed(2)}ms`;
}

function createLogger(userOptions) {
  const options = Object.assign({}, DEFAULTS, userOptions);

  const tokens = Object.assign({
    method:   (req) => req.method,
    url:      (req) => req.originalUrl || req.url,
    status:   (req, res) => res.statusCode,
    duration: (req, res, ms) => formatDuration(ms),
    ip:       (req) => req.ip || req.connection?.remoteAddress,
    date:     () => timestamp(),
  }, options.tokens);

  return function requestLogger(req, res, next) {
    const startAt = process.hrtime.bigint();

    res.on('finish', () => {
      if (typeof options.skip === 'function' && options.skip(req, res)) {
        return;
      }

      const endAt   = process.hrtime.bigint();
      const duration = Number(endAt - startAt) / 1_000_000;

      let line;

      if (typeof options.formatFn === 'function') {
        line = options.formatFn(req, res, duration, tokens);
      } else if (options.format === 'json') {
        line = formatJSON(req, res, duration);
      } else if (options.format === 'combined') {
        line = formatCombined(req, res, duration);
      } else {
        line = formatText(req, res, duration, options);
      }

      options.stream.write(line + '\n');
    });

    next();
  };
}

module.exports = createLogger;

module.exports.formatDuration = formatDuration;
module.exports.statusColor    = statusColor;
module.exports.DEFAULTS       = DEFAULTS;
