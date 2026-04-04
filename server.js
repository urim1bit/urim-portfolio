const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL Visitor Counter ───
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY DEFAULT 1,
      count BIGINT NOT NULL DEFAULT 0,
      CHECK (id = 1)
    )
  `);
  await pool.query(`
    INSERT INTO visitors (id, count) VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING
  `);
}

initDB().catch(err => console.error('DB init error:', err));

async function incrementCount() {
  const result = await pool.query(
    'UPDATE visitors SET count = count + 1 WHERE id = 1 RETURNING count'
  );
  return result.rows[0].count;
}

async function getCount() {
  const result = await pool.query('SELECT count FROM visitors WHERE id = 1');
  return result.rows[0]?.count || 0;
}

// ─── Prevent Cloudflare from modifying HTML responses ───
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-transform');
  next();
});

// ─── Force HTTPS in production ───
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// ─── Redirect .html requests to clean URLs ───
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    const finalPath = cleanPath === '/index' ? '/' : cleanPath;
    return res.redirect(301, finalPath || '/');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Page routes ───
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/paytrack', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'paytrack.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/story', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'story.html'));
});

app.get('/account-deletion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account-deletion.html'));
});

app.get('/materialyou', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'materialyou.html'));
});

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

// ─── Visitor counter API ───
app.post('/api/visitors', async (req, res) => {
  try {
    const count = await incrementCount();
    res.json({ count: Number(count) });
  } catch (err) {
    console.error('Visitor increment error:', err);
    res.status(500).json({ count: 0 });
  }
});

app.get('/api/visitors', async (req, res) => {
  try {
    const count = await getCount();
    res.json({ count: Number(count) });
  } catch (err) {
    console.error('Visitor get error:', err);
    res.status(500).json({ count: 0 });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Portfolio running at http://localhost:${PORT}`);
});
