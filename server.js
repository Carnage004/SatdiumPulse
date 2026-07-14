const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Serve all static files (index.html, styles.css, js/, json/ etc.) from root
app.use(express.static(__dirname));

// POST proxy endpoint for the Gemini API
app.post('/api/chat', async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API error:', response.status, errorBody);
      return res.status(500).json({ error: errorBody });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html for any fallback route to support standard SPA routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`StadiumPulse backend proxy listening on port ${PORT}`);
  console.log('GEMINI_API_KEY is set:', !!process.env.GEMINI_API_KEY);
  console.log('GEMINI_API_KEY length:', (process.env.GEMINI_API_KEY || '').length);
  console.log('GEMINI_API_KEY first 4 chars:', (process.env.GEMINI_API_KEY || '').slice(0, 4));
  console.log('All env var names containing GEMINI:', Object.keys(process.env).filter(k => k.toUpperCase().includes('GEMINI')));
});
