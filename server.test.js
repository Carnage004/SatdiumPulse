const test = require('node:test');
const assert = require('node:assert');
const app = require('./server.js');
const http = require('http');

let server;
let port;

test.before(async () => {
  return new Promise((resolve) => {
    // Start the server on a random available port for end-to-end testing
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
});

test.after(async () => {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
});

// Helper function to send HTTP requests to the test server
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      port,
      hostname: '127.0.0.1',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// ── Test Suite 1: CORS Restrictions ──────────────────────────────────────────
test('CORS - allows requests originating from localhost', async () => {
  const res = await request({
    method: 'OPTIONS',
    path: '/api/chat',
    headers: { 'Origin': 'http://localhost:3000' }
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
});

test('CORS - blocks unauthorized external origins', async () => {
  const res = await request({
    method: 'OPTIONS',
    path: '/api/chat',
    headers: { 'Origin': 'http://malicious-site.com' }
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['access-control-allow-origin'], 'null');
});

// ── Test Suite 2: Input Validation ────────────────────────────────────────────
test('Validation - rejects empty request body', async () => {
  const res = await request({
    method: 'POST',
    path: '/api/chat'
  }, '');
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes("contents"));
});

test('Validation - rejects request with missing contents array', async () => {
  const res = await request({
    method: 'POST',
    path: '/api/chat'
  }, { contents: [] });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes("contents"));
});

test('Validation - rejects empty message text', async () => {
  const res = await request({
    method: 'POST',
    path: '/api/chat'
  }, {
    contents: [{ role: 'user', parts: [{ text: '   ' }] }]
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes("empty"));
});

test('Validation - rejects message text exceeding 2000 characters', async () => {
  const longText = 'a'.repeat(2001);
  const res = await request({
    method: 'POST',
    path: '/api/chat'
  }, {
    contents: [{ role: 'user', parts: [{ text: longText }] }]
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes("too long"));
});

// ── Test Suite 3: Mocking API calls & Retry handling ─────────────────────────
test('Retry - recovers on 503 Service Unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  
  // Fast-forward setTimeouts inside the test
  globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);

  let fetchCallCount = 0;
  globalThis.fetch = async (url) => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      return {
        status: 503,
        ok: false,
        text: async () => 'Service Unavailable'
      };
    }
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Mock response after retry" }] } }]
      })
    };
  };

  try {
    const res = await request({
      method: 'POST',
      path: '/api/chat'
    }, {
      contents: [{ role: 'user', parts: [{ text: 'How do I get to Section 120?' }] }]
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(fetchCallCount, 2); // Confirms retry mechanism was invoked once

    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.candidates[0].content.parts[0].text, "Mock response after retry");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('Retry - handles double failure and returns friendly busy notice', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  
  globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);

  let fetchCallCount = 0;
  globalThis.fetch = async () => {
    fetchCallCount++;
    return {
      status: 503,
      ok: false,
      text: async () => 'Service Unavailable'
    };
  };

  try {
    const res = await request({
      method: 'POST',
      path: '/api/chat'
    }, {
      contents: [{ role: 'user', parts: [{ text: 'How do I get to Section 120?' }] }]
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(fetchCallCount, 2); // Attempted once + retried once

    const parsed = JSON.parse(res.body);
    assert.ok(parsed.candidates[0].content.parts[0].text.includes("busy right now"));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
