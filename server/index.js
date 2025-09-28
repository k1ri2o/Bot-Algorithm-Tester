const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;

// Basic allowlist CORS for local dev and your domain
const allowedOrigins = new Set([
  'http://127.0.0.1:5500',
  'https://algotester.site'
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '1mb' }));

// Optional: simple token gate using query params
const REQUIRED_SECURITY_TOKEN = '59LdrEJCGFlfGNN';
const REQUIRED_ADMIN_TOKEN = 'assist_aff';

function verifyTokens(req, res) {
  const securityToken = req.query.securityToken;
  const adminToken = req.query.adminToken;
  if (securityToken !== REQUIRED_SECURITY_TOKEN || adminToken !== REQUIRED_ADMIN_TOKEN) {
    res.status(401).json({ error: 'Not authorized' });
    return false;
  }
  return true;
}

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'scans.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.get('/api/scans', (req, res) => {
  if (!verifyTokens(req, res)) return;
  if (!fs.existsSync(DATA_FILE)) {
    return res.status(404).json({ error: 'No data yet' });
  }
  try {
    const text = fs.readFileSync(DATA_FILE, 'utf8');
    const json = JSON.parse(text);
    return res.json(json);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post('/api/scans', (req, res) => {
  if (!verifyTokens(req, res)) return;
  const body = req.body || {};
  // Basic shape validation
  if (!body || !Array.isArray(body.labels) || typeof body.metrics !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2), 'utf8');
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to save data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});


