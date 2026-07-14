const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Serve all static files (index.html, styles.css, js/, json/ etc.) from root
app.use(express.static(__dirname));

const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

// POST proxy endpoint for the Gemini API
app.post('/api/chat', async (req, res) => {
  try {
    const makeGeminiRequest = async (model) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
    };

    let response = await makeGeminiRequest(PRIMARY_MODEL);

    // If primary model returns 404 (model not found/available), retry with fallback model
    if (response.status === 404) {
      console.warn(`Primary model ${PRIMARY_MODEL} returned 404. Retrying with fallback model ${FALLBACK_MODEL}...`);
      response = await makeGeminiRequest(FALLBACK_MODEL);
      if (response.ok) {
        console.log(`Successfully used fallback model: ${FALLBACK_MODEL}`);
      }
    } else if (response.ok) {
      console.log(`Successfully used primary model: ${PRIMARY_MODEL}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API error:', response.status, errorBody);
      return res.status(response.status).json({ error: errorBody });
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
