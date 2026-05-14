# express-request-logger

**Framework Design — Extension/Plugin**

A lightweight, configurable HTTP request logger middleware for [Express.js](https://expressjs.com/). Logs each request's HTTP method, route, response status code, and execution time. Designed to be a reusable, drop-in plugin for monitoring and debugging Express applications.

---

## What it does

Every time a request is received and a response is sent, the middleware emits a log line like this (text format):

```
2025-04-21 14:03:11  GET     /users          →  200  3.47ms  124b
2025-04-21 14:03:12  POST    /users          →  400  1.12ms
2025-04-21 14:03:13  GET     /users/99       →  404  0.89ms
2025-04-21 14:03:14  DELETE  /users/1        →  204  2.01ms
2025-04-21 14:03:15  GET     /crash          →  500  0.55ms
```

Or as newline-delimited JSON (for log aggregators like Datadog, Loki, etc.):

```json
{"timestamp":"2025-04-21T14:03:11.000Z","method":"GET","url":"/users","status":200,"duration":3.47,"durationUnit":"ms","ip":"::1","responseSize":124}
```

---

## Installation

```bash
npm install express-request-logger
```

Or, to use locally from source:

```bash
git clone <repo-url>
cd express-request-logger
npm install
```

---

## Quick start

```js
const express = require('express');
const logger  = require('express-request-logger');

const app = express();

app.use(logger()); // add before your routes

app.get('/', (req, res) => res.json({ ok: true }));

app.listen(3000);
```

That is all that is required. The middleware is registered before the routes so it intercepts every request.

---

## How it works (internals)

The middleware follows the standard Express middleware signature:

```js
function requestLogger(req, res, next) {
  const startAt = process.hrtime.bigint(); // high-resolution timer

  res.on('finish', () => {            // fires after response is sent
    const duration = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    // format and write the log line
  });

  next(); // pass control to the next middleware / route handler
}
```

Key design decisions:

- **`process.hrtime.bigint()`** is used instead of `Date.now()` for sub-millisecond precision.
- **`res.on('finish')`** fires after the response body has been fully sent, so the status code and Content-Length header are already set.
- `next()` is always called synchronously — the middleware never blocks the request.

---

## API

### `logger(options?)`

Creates and returns an Express middleware function.

```js
app.use(logger(options));
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `format` | `'text' \| 'json' \| 'combined'` | `'text'` | Output format. `combined` is Apache Combined Log Format. |
| `colors` | `boolean` | `true` | Enable ANSI color codes in text mode. Auto-disabled for non-TTY streams. |
| `stream` | `WritableStream` | `process.stdout` | Output destination. Pass a file stream to write to a log file. |
| `skip` | `(req, res) => boolean` | `null` | If the function returns `true`, the request is not logged. |
| `logBodySize` | `boolean` | `true` | Include response `Content-Length` in the log line. |
| `logUserAgent` | `boolean` | `false` | Include the `User-Agent` header in the log line. |
| `prefix` | `string` | `''` | Prepend a service name label to each log line. |
| `formatFn` | `(req, res, duration) => string` | `null` | Custom format function. Overrides `format`. |

---

## Examples

### Default (colored text output)

```js
app.use(logger());
```

### JSON format for log aggregators

```js
app.use(logger({ format: 'json' }));
```

### Skip health-check and metrics routes

```js
app.use(logger({
  skip: (req) => ['/health', '/metrics', '/ping'].includes(req.path),
}));
```

### Write to a log file

```js
const fs = require('fs');
const stream = fs.createWriteStream('./access.log', { flags: 'a' });

app.use(logger({ format: 'json', stream }));
```

### Add a service name prefix

```js
app.use(logger({ prefix: 'USER-SERVICE' }));
// → [USER-SERVICE] 2025-04-21 14:03:11  GET  /users  →  200  3.47ms
```

### Show User-Agent

```js
app.use(logger({ logUserAgent: true }));
```

### Custom format function

```js
app.use(logger({
  formatFn: (req, res, duration) =>
    `${req.method} ${req.url} → ${res.statusCode} (${duration.toFixed(1)}ms)`,
}));
```

### Apache Combined Log Format

```js
app.use(logger({ format: 'combined' }));
// → ::1 - - [Mon, 21 Apr 2025 14:03:11 GMT] "GET /users HTTP/1.1" 200 124 "-" "curl/7.64.1" 3.47ms
```

---

## Color coding (text mode)

| Status code | Color  | Meaning        |
|---|---|---|
| 2xx         | Green  | Success        |
| 3xx         | Cyan   | Redirect       |
| 4xx         | Yellow | Client error   |
| 5xx         | Red    | Server error   |

HTTP methods are also color-coded:

| Method  | Color   |
|---|---|
| GET     | Green   |
| POST    | Blue    |
| PUT     | Yellow  |
| PATCH   | Magenta |
| DELETE  | Red     |

---

## Running the demo

```bash
npm run demo
```

Then open a second terminal and make some requests:

```bash
curl http://localhost:3000/
curl http://localhost:3000/users
curl http://localhost:3000/users/1
curl http://localhost:3000/users/99
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Carol"}'
curl http://localhost:3000/crash
curl http://localhost:3000/slow
```

---

## Running the tests

```bash
npm test
```

The test suite uses only Node.js built-ins (no external test framework). It tests:

- `formatDuration()` for all three output ranges (µs, ms, s)
- `statusColor()` for each status class
- Middleware behavior: calls `next()`, logs on finish, JSON output, `skip` option, custom `formatFn`, and `prefix`

---

## Project structure

```
express-request-logger/
├── src/
│   └── index.js          — middleware implementation
├── demo/
│   └── app.js            — example Express app
├── test/
│   └── middleware.test.js — test suite (no external deps)
├── package.json
└── DOCUMENTATION.md
```

---

## Comparison with similar tools

| Feature | express-request-logger | morgan | winston |
|---|---|---|---|
| Zero runtime deps | ✓ | ✓ | ✗ |
| Colored output | ✓ | ✓ | ✓ |
| JSON format | ✓ | Partial | ✓ |
| `skip` function | ✓ | ✓ | — |
| Custom format fn | ✓ | ✓ | ✓ |
| File output | ✓ | ✓ | ✓ |
| High-res timer | ✓ | ✗ | — |
| Apache combined | ✓ | ✓ | — |

---

## License

MIT
