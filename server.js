const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Prevent Cloudflare from modifying HTML responses (disables email obfuscation)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-transform');
  next();
});

// Force HTTPS in production
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// Redirect any .html requests to clean URLs
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5); // remove .html
    const finalPath = cleanPath === '/index' ? '/' : cleanPath;
    return res.redirect(301, finalPath || '/');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
  console.log(`🚀 Portfolio running at http://localhost:${PORT}`);
});
