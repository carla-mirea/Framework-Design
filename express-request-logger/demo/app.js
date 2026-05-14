'use strict';

const express   = require('express');
const logger    = require('../src/index');

const app = express();
app.use(express.json());

app.use(logger());

// app.use(logger({ format: 'json' }));

// app.use(logger({
//   skip: (req) => req.path === '/health',
//   logUserAgent: true,
//   prefix: 'API',
// }));

// app.use(logger({
//   formatFn: (req, res, duration) =>
//     `>> ${req.method} ${req.url} completed with ${res.statusCode} in ${duration.toFixed(1)}ms`,
// }));

// const fs = require('fs');
// const logStream = fs.createWriteStream('./requests.log', { flags: 'a' });
// app.use(logger({ format: 'json', stream: logStream }));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the demo API', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'Alice', role: 'admin' },
    { id: 2, name: 'Bob',   role: 'user'  },
  ]);
});

app.get('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (id === 1) return res.json({ id: 1, name: 'Alice', role: 'admin' });
  if (id === 2) return res.json({ id: 2, name: 'Bob',   role: 'user'  });
  res.status(404).json({ error: 'User not found' });
});

app.post('/users', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing required field: name' });
  res.status(201).json({ id: 3, name, role: 'user' });
});

app.delete('/users/:id', (req, res) => {
  res.status(204).send();
});

app.get('/crash', (req, res) => {
  res.status(500).json({ error: 'Internal server error (simulated)' });
});

app.get('/slow', async (req, res) => {
  await new Promise(r => setTimeout(r, 500));
  res.json({ message: 'That took a while...' });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nDemo server running at http://localhost:${PORT}`);
  console.log('Try these routes:');
  console.log('  GET  /');
  console.log('  GET  /health');
  console.log('  GET  /users');
  console.log('  GET  /users/1');
  console.log('  GET  /users/99        (→ 404)');
  console.log('  POST /users           (→ 400 if no body)');
  console.log('  GET  /crash           (→ 500)');
  console.log('  GET  /slow            (→ ~500ms)');
  console.log('  GET  /nonexistent     (→ 404)\n');
});
