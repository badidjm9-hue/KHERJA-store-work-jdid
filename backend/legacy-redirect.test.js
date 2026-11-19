// Legacy routes redirect to the one-app shell outside dev mode (no-store); /app, /admin and the API keep working; dev mode keeps legacy pages for the old suites.
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
async function get(opts, p) { const s = createApp(opts); await new Promise(r => s.listen(0, r)); try { const r = await fetch('http://127.0.0.1:' + s.address().port + p, { redirect: 'manual' }); return { s: r.status, loc: r.headers.get('location'), cc: r.headers.get('cache-control') }; } finally { await new Promise(r => s.close(r)); } }
test('non-dev: / , /index.html , /driver redirect with no-store', async () => {
  for (const [p, to] of [['/', '/app'], ['/index.html', '/app'], ['/driver', '/app/driver']]) { const r = await get({}, p); assert.equal(r.s, 302, p); assert.equal(r.loc, to); assert.match(r.cc, /no-store/); }
});
test('non-dev: /app, /app/driver, /admin and /api/health are not redirected', async () => {
  for (const p of ['/app', '/app/driver', '/admin', '/api/health']) { const r = await get({}, p); assert.equal(r.s, 200, p); assert.equal(r.loc, null); }
});
test('dev mode keeps legacy pages (old suites) and redirectLegacy can force the redirect', async () => {
  assert.equal((await get({ dev: true }, '/')).s, 200); assert.equal((await get({ dev: true, redirectLegacy: true }, '/driver')).s, 302);
});
