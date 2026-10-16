// pairing-api.js — Test version
const express = require('express');
const app = express();

app.use(express.json());

// Simple CORS so future website can call us
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Test endpoint — just proves the server works
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Alpha-XMD Pairing API is live',
    timestamp: new Date().toISOString()
  });
});

// This is where the pairing code endpoint will go later — for now, just a placeholder
app.post('/api/pair', (req, res) => {
  res.json({
    status: 'placeholder',
    message: 'Pairing endpoint not wired yet — coming in Step 3'
  });
});

const PORT = process.env.PAIRING_API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Pairing API running on port ${PORT}`);
});

module.exports = app;