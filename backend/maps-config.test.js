'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

async function withServer(fn) {
  const s = createApp({ dev: true, devAdmin: true });
  await new Promise(r => s.listen(0, r));
  try { await fn('http://127.0.0.1:' + s.address().port); }
  finally { await new Promise(r => s.close(r)); }
}

test('maps config endpoint does not enable Google Maps without a browser key', async () => {
  const prev = process.env.MAPS_BROWSER_API_KEY;
  delete process.env.MAPS_BROWSER_API_KEY;
  try { await withServer(async base => {
    const r = await fetch(base + '/api/config/maps');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { enabled: false, browser_key: null, provider: null });
  }); } finally { if (prev === undefined) delete process.env.MAPS_BROWSER_API_KEY; else process.env.MAPS_BROWSER_API_KEY = prev; }
});

test('maps config endpoint exposes only the explicitly designated browser key', async () => {
  const prev = process.env.MAPS_BROWSER_API_KEY;
  process.env.MAPS_BROWSER_API_KEY = 'browser-key-for-test';
  try { await withServer(async base => {
    const r = await fetch(base + '/api/config/maps');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { enabled: true, browser_key: 'browser-key-for-test', provider: 'google' });
  }); } finally { if (prev === undefined) delete process.env.MAPS_BROWSER_API_KEY; else process.env.MAPS_BROWSER_API_KEY = prev; }
});
