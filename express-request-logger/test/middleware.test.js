'use strict';

const http   = require('http');
const assert = require('assert');

const createLogger    = require('../src/index');
const { formatDuration, statusColor } = require('../src/index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\nformatDuration()');

test('formats microseconds for sub-ms values', () => {
  const result = formatDuration(0.5);
  assert.strictEqual(result, '500µs');
});

test('formats milliseconds for values < 1000ms', () => {
  const result = formatDuration(42.5);
  assert.strictEqual(result, '42.50ms');
});

test('formats seconds for values >= 1000ms', () => {
  const result = formatDuration(1500);
  assert.strictEqual(result, '1.50s');
});

console.log('\nstatusColor()');

test('returns green for 2xx', () => {
  assert.ok(statusColor(200).includes('32'));
});

test('returns yellow for 4xx', () => {
  assert.ok(statusColor(404).includes('33'));
});

test('returns red for 5xx', () => {
  assert.ok(statusColor(500).includes('31'));
});

console.log('\nMiddleware integration');

function makeMockReq(overrides = {}) {
  return {
    method: 'GET',
    originalUrl: '/test',
    url: '/test',
    path: '/test',
    headers: { 'user-agent': 'TestAgent/1.0' },
    ip: '127.0.0.1',
    httpVersion: '1.1',
    connection: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

function makeMockRes(statusCode = 200, overrides = {}) {
  const listeners = {};
  return {
    statusCode,
    isTTY: false,
    getHeader: () => null,
    on(event, fn) { listeners[event] = fn; },
    emit(event) { if (listeners[event]) listeners[event](); },
    ...overrides,
  };
}

test('calls next()', () => {
  let nextCalled = false;
  const middleware = createLogger({ stream: { write: () => {}, isTTY: false } });
  const req = makeMockReq();
  const res = makeMockRes();
  middleware(req, res, () => { nextCalled = true; });
  assert.ok(nextCalled);
});

test('logs something on res finish (text format)', () => {
  let output = '';
  const stream = { write: (line) => { output = line; }, isTTY: false };
  const middleware = createLogger({ format: 'text', colors: false, stream });

  const req = makeMockReq();
  const res = makeMockRes(200);
  middleware(req, res, () => {});
  res.emit('finish');

  assert.ok(output.length > 0, 'Output should not be empty');
  assert.ok(output.includes('GET'), 'Should contain method');
  assert.ok(output.includes('/test'), 'Should contain route');
  assert.ok(output.includes('200'), 'Should contain status code');
});

test('logs JSON when format is json', () => {
  let output = '';
  const stream = { write: (line) => { output = line; }, isTTY: false };
  const middleware = createLogger({ format: 'json', stream });

  const req = makeMockReq({ method: 'POST', originalUrl: '/api/data' });
  const res = makeMockRes(201);
  middleware(req, res, () => {});
  res.emit('finish');

  const parsed = JSON.parse(output);
  assert.strictEqual(parsed.method, 'POST');
  assert.strictEqual(parsed.url, '/api/data');
  assert.strictEqual(parsed.status, 201);
  assert.ok(typeof parsed.duration === 'number');
});

test('skip option prevents logging', () => {
  let output = '';
  const stream = { write: (line) => { output = line; }, isTTY: false };
  const middleware = createLogger({
    stream,
    skip: (req) => req.path === '/health',
  });

  const req = makeMockReq({ path: '/health', originalUrl: '/health' });
  const res = makeMockRes(200);
  middleware(req, res, () => {});
  res.emit('finish');

  assert.strictEqual(output, '', 'Health route should be skipped');
});

test('custom formatFn is used', () => {
  let output = '';
  const stream = { write: (line) => { output = line; }, isTTY: false };
  const middleware = createLogger({
    stream,
    formatFn: (req, res, duration) => `CUSTOM:${req.method}:${res.statusCode}`,
  });

  const req = makeMockReq({ method: 'DELETE' });
  const res = makeMockRes(204);
  middleware(req, res, () => {});
  res.emit('finish');

  assert.ok(output.startsWith('CUSTOM:DELETE:204'));
});

test('prefix is added to text output', () => {
  let output = '';
  const stream = { write: (line) => { output = line; }, isTTY: false };
  const middleware = createLogger({ stream, prefix: 'MY-SERVICE', colors: false });

  const req = makeMockReq();
  const res = makeMockRes(200);
  middleware(req, res, () => {});
  res.emit('finish');

  assert.ok(output.includes('[MY-SERVICE]'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
