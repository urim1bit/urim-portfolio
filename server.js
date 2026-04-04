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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_locations (
      id SERIAL PRIMARY KEY,
      lat FLOAT NOT NULL,
      lng FLOAT NOT NULL,
      country TEXT,
      city TEXT,
      flag TEXT,
      visited_at TIMESTAMPTZ DEFAULT NOW()
    )
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
    // Log location asynchronously (don't block response)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    getGeoLocation(ip).then(geo => {
      if (geo) {
        pool.query(
          'INSERT INTO visitor_locations (lat, lng, country, city, flag) VALUES ($1, $2, $3, $4, $5)',
          [geo.lat, geo.lng, geo.country, geo.city, geo.flag]
        ).catch(() => {});
      }
    });
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


// ─── Visitor Location API ───
async function getGeoLocation(ip) {
  try {
    // Use ip-api.com free tier (no key needed, 1000 req/month limit)
    const cleanIp = ip.replace('::ffff:', '');
    if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('192.168')) {
      return { lat: 35.8997, lng: 14.5147, country: 'Malta', city: 'Valletta', flag: '🇲🇹' };
    }
    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=lat,lon,country,city,countryCode`);
    const data = await response.json();
    if (data.lat && data.lon) {
      const flag = data.countryCode
        ? String.fromCodePoint(...[...data.countryCode.toUpperCase()].map(c => 0x1F1E0 + c.charCodeAt(0) - 65))
        : '';
      return { lat: data.lat, lng: data.lon, country: data.country, city: data.city, flag };
    }
  } catch (e) { /* silently fail */ }
  return null;
}

app.get('/api/visitor-locations', async (req, res) => {
  try {
    const locs = await pool.query(`
      SELECT lat, lng, country, city, flag
      FROM visitor_locations
      WHERE visited_at > NOW() - INTERVAL '30 days'
      ORDER BY visited_at DESC
      LIMIT 200
    `);
    const countries = new Set(locs.rows.map(r => r.country).filter(Boolean)).size;
    const totalRes = await pool.query('SELECT count FROM visitors WHERE id = 1');
    res.json({
      locations: locs.rows,
      countries,
      total: Number(totalRes.rows[0]?.count || 0)
    });
  } catch (err) {
    console.error('Location fetch error:', err);
    res.json({ locations: [], countries: 0, total: 0 });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Portfolio running at http://localhost:${PORT}`);
});
