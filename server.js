const express = require('express');
const path = require('path');

const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Restrict CORS origins to same-origin and localhost/127.0.0.1
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configure Rate Limiter to prevent runaway API costs
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: { error: "Too many requests. Please try again in a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve all static files (index.html, styles.css, js/, json/ etc.) from root
app.use(express.static(__dirname));

const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

// POST proxy endpoint for the Gemini API
app.post('/api/chat', chatLimiter, async (req, res) => {
  // Input Validation
  if (!req.body || !req.body.contents || !Array.isArray(req.body.contents) || req.body.contents.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'contents' in request body." });
  }

  const lastMessage = req.body.contents[req.body.contents.length - 1];
  if (!lastMessage || !lastMessage.parts || !Array.isArray(lastMessage.parts) || lastMessage.parts.length === 0) {
    return res.status(400).json({ error: "Invalid parts structure in the last message." });
  }

  const messageText = lastMessage.parts[0].text;
  if (typeof messageText !== 'string' || messageText.trim() === '') {
    return res.status(400).json({ error: "Message body cannot be empty." });
  }

  if (messageText.length > 2000) {
    return res.status(400).json({ error: "Message body is too long (maximum 2000 characters)." });
  }

  try {
    const makeGeminiRequest = async (model) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      // Build request body with high output token allowance and disabled thinking model configurations
      const payload = { ...req.body };
      payload.generationConfig = {
        ...(payload.generationConfig || {}),
        maxOutputTokens: 2048,
        thinkingConfig: {
          thinkingBudget: 0
        }
      };

      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    };

    const fetchWithRetry = async (model) => {
      let resVal = await makeGeminiRequest(model);
      if (resVal.status === 503 || resVal.status === 429) {
        console.warn(`Model ${model} returned status ${resVal.status}. Retrying in 7 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 7000));
        resVal = await makeGeminiRequest(model);
      }
      return resVal;
    };

    let response = await fetchWithRetry(PRIMARY_MODEL);

    // If primary model returns 404 (model not found/available), retry with fallback model
    if (response.status === 404) {
      console.warn(`Primary model ${PRIMARY_MODEL} returned 404. Retrying with fallback model ${FALLBACK_MODEL}...`);
      response = await fetchWithRetry(FALLBACK_MODEL);
      if (response.ok) {
        console.log(`Successfully used fallback model: ${FALLBACK_MODEL}`);
      }
    } else if (response.ok) {
      console.log(`Successfully used primary model: ${PRIMARY_MODEL}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API error after retry:', response.status, errorBody);
      // Return a friendly JSON response instead of crashing or triggering default greeting
      return res.json({
        candidates: [{
          content: {
            parts: [{
              text: "The assistant is a bit busy right now — please try again in a moment."
            }]
          }
        }]
      });
    }

    const rawResponseText = await response.text();
    console.log("RAW GEMINI RESPONSE:", rawResponseText);

    const data = JSON.parse(rawResponseText);
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

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`StadiumPulse backend proxy listening on port ${PORT}`);
    console.log('GEMINI_API_KEY is set:', !!process.env.GEMINI_API_KEY);
    console.log('GEMINI_API_KEY length:', (process.env.GEMINI_API_KEY || '').length);
    console.log('GEMINI_API_KEY first 4 chars:', (process.env.GEMINI_API_KEY || '').slice(0, 4));
    console.log('All env var names containing GEMINI:', Object.keys(process.env).filter(k => k.toUpperCase().includes('GEMINI')));
  });
}

module.exports = app;
