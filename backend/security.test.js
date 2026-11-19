// Proves the development-mode protections. Run: node --test backend/security.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createApp, resolveConfig } = require('./server');
const SERVER = path.join(__dirname, 'server.js');

const start = async opts => { const s = createApp(opts); await new Promise(r => s.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + s.address().port;
  const call = async (m, p, b, cookie) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.getSetCookie().map(c => c.split(';')[0]).join('; '); return { s: r.status, j: await r.json().catch(() => null), cookie: sc }; };
  return { call, base, stop: () => new Promise(r => s.close(r)) }; };
const withEnv = async (patch, fn) => { const old = {}; for (const k of Object.keys(patch)) { old[k] = process.env[k]; if (patch[k] === undefined) delete process.env[k]; else process.env[k] = patch[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } } };
const ADMIN = { phone: '0550000000', password: 'admin-dev-pass' };

/* ---- 1. default createApp() is secure ---- */
test('default app: fixed OTP 123456 is rejected', async () => {
  const a = await start({}); try {
    assert.equal((await a.call('POST', '/api/auth/otp', { phone: '0555000111' })).s, 503); // Phase 2.1: secure mode without an SMS sender says so (was 200)
    assert.equal((await a.call('POST', '/api/auth/verify', { phone: '0555000111', code: '123456' })).s, 400);
  } finally { await a.stop(); } });
test('default app: dev admin credentials are rejected', async () => {
  const a = await start({}); try { assert.equal((await a.call('POST', '/api/admin/login', ADMIN)).s, 401); } finally { await a.stop(); } });
test('default app: /api/dev/role does not exist, even for a logged-in-looking request', async () => {
  const a = await start({}); try {
    assert.equal((await a.call('POST', '/api/dev/role', { role: 'driver' })).s, 404);
    assert.equal((await a.call('POST', '/api/dev/role', { role: 'driver' }, 'sid=anything')).s, 404);
  } finally { await a.stop(); } });


test('same-origin guard rejects cross-site and mismatched Origin mutations', async () => {
  const a = await start({});
  try {
    const cross = await fetch(a.base + '/api/auth/otp', { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: JSON.stringify({ phone: '0555000999' }) });
    assert.equal(cross.status, 403);
    const mismatch = await fetch(a.base + '/api/auth/otp', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://attacker.example' }, body: JSON.stringify({ phone: '0555000999' }) });
    assert.equal(mismatch.status, 403);
    const same = await fetch(a.base + '/api/auth/otp', { method: 'POST', headers: { 'content-type': 'application/json', origin: a.base }, body: JSON.stringify({ phone: '0555000999' }) });
    assert.equal(same.status, 503);
  } finally { await a.stop(); }
});

/* ---- 2. dev:true alone does not enable the dev admin ---- */
test('dev mode (without devAdmin): OTP 123456 works, /api/dev/role works, dev admin still rejected', async () => {
  const a = await start({ dev: true }); try {
    await a.call('POST', '/api/auth/otp', { phone: '0555000222' });
    const v = await a.call('POST', '/api/auth/verify', { phone: '0555000222', code: '123456' }); assert.equal(v.s, 200);
    assert.equal((await a.call('POST', '/api/dev/role', { role: 'driver' }, v.cookie)).s, 200);
    assert.equal((await a.call('POST', '/api/admin/login', ADMIN)).s, 401);
  } finally { await a.stop(); } });

/* ---- 3. explicit opt-in works (local workflow preserved) ---- */
test('dev + devAdmin: dev admin login works', async () => {
  const a = await start({ dev: true, devAdmin: true }); try { assert.equal((await a.call('POST', '/api/admin/login', ADMIN)).s, 200); } finally { await a.stop(); } });

/* ---- 4. unsafe combinations refuse to start ---- */
test('createApp refuses devAdmin without dev', () => { assert.throws(() => createApp({ devAdmin: true }), /devAdmin requires dev/); });
test('createApp refuses dev mode when NODE_ENV=production', () => withEnv({ NODE_ENV: 'production' }, () => {
  assert.throws(() => createApp({ dev: true }), /not allowed when NODE_ENV=production/);
  assert.throws(() => createApp({ dev: true, devAdmin: true }), /not allowed when NODE_ENV=production/); }));
test('createApp refuses the dev admin password outside dev-admin mode (option and env)', () => {
  assert.throws(() => createApp({ admin: ADMIN }), /development admin password/);
  assert.throws(() => createApp({ dev: true, admin: ADMIN }), /development admin password/);
  return withEnv({ ADMIN_PHONE: '0550000001', ADMIN_PASSWORD: 'admin-dev-pass' }, () => assert.throws(() => createApp({}), /development admin password/)); });
test('a strong configured admin works in a non-dev app', async () => {
  const a = await start({ admin: { phone: '0550000009', password: 'a-long-unique-secret-9X' } }); try {
    assert.equal((await a.call('POST', '/api/admin/login', { phone: '0550000009', password: 'a-long-unique-secret-9X' })).s, 200);
    assert.equal((await a.call('POST', '/api/admin/login', ADMIN)).s, 401);
  } finally { await a.stop(); } });

/* ---- 5. an old database that still holds the dev admin password is neutralised ---- */
test('existing DB with dev admin password: login fails once dev admin is off', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-sec-')), db = path.join(dir, 't.db');
  try {
    let a = await start({ dbPath: db, dev: true, devAdmin: true }); assert.equal((await a.call('POST', '/api/admin/login', ADMIN)).s, 200); await a.stop();
    a = await start({ dbPath: db }); assert.equal((await a.call('POST', '/api/admin/login', ADMIN)).s, 401); await a.stop();
    a = await start({ dbPath: db, dev: true }); assert.equal((await a.call('POST', '/api/admin/login', ADMIN)).s, 401); await a.stop();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } });

/* ---- 6. resolveConfig: development is never inferred ---- */
test('resolveConfig: no env => secure; unset NODE_ENV does NOT enable dev', () => {
  for (const env of [{}, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'staging' }]) { const c = resolveConfig(env); assert.equal(c.dev, false); assert.equal(c.devAdmin, false); assert.equal(c.host, '0.0.0.0'); } });
test('resolveConfig: only "1"/"true" turn dev on; other values stay off', () => {
  for (const v of ['0', 'false', 'yes', 'on', '', ' 1']) assert.equal(resolveConfig({ KHERJA_DEV: v }).dev, false, v);
  assert.equal(resolveConfig({ KHERJA_DEV: '1' }).dev, true); assert.equal(resolveConfig({ KHERJA_DEV: 'true' }).dev, true); });
test('resolveConfig: dev binds to loopback by default and refuses non-loopback HOST', () => {
  assert.equal(resolveConfig({ KHERJA_DEV: '1' }).host, '127.0.0.1');
  assert.throws(() => resolveConfig({ KHERJA_DEV: '1', HOST: '0.0.0.0' }), /loopback/);
  assert.throws(() => resolveConfig({ KHERJA_DEV: '1', HOST: '192.168.1.5' }), /loopback/);
  assert.equal(resolveConfig({ KHERJA_DEV: '1', HOST: 'localhost' }).host, 'localhost'); });
test('resolveConfig: production refuses any dev flag', () => {
  assert.throws(() => resolveConfig({ NODE_ENV: 'production', KHERJA_DEV: '1' }), /NODE_ENV=production/);
  assert.throws(() => resolveConfig({ NODE_ENV: 'production', KHERJA_DEV_ADMIN: '1' }), /NODE_ENV=production/);
  assert.throws(() => resolveConfig({ NODE_ENV: 'production', KHERJA_DEV: '1', KHERJA_DEV_ADMIN: '1' }), /NODE_ENV=production/);
  assert.equal(resolveConfig({ NODE_ENV: 'production' }).dev, false); });
test('resolveConfig: KHERJA_DEV_ADMIN requires KHERJA_DEV', () => { assert.throws(() => resolveConfig({ KHERJA_DEV_ADMIN: '1' }), /requires KHERJA_DEV/); });

/* ---- 7. the real process (what operators actually run) ---- */
const run = (env, { waitFor } = {}) => new Promise(resolve => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-proc-'));
  const p = spawn(process.execPath, ['--no-warnings', SERVER], { cwd: dir, env: { PATH: process.env.PATH, DB_PATH: path.join(dir, 'p.db'), PORT: '0', ...env } });
  let out = '', err = ''; p.stdout.on('data', d => { out += d; if (waitFor && waitFor.test(out)) resolve({ p, out: () => out, err: () => err, dir }); });
  p.stderr.on('data', d => err += d); p.on('exit', code => resolve({ code, out, err, dir })); setTimeout(() => { p.kill(); resolve({ code: 'timeout', out, err, dir }); }, 8000); });
test('process: NODE_ENV=production + KHERJA_DEV=1 exits non-zero before listening', async () => {
  const r = await run({ NODE_ENV: 'production', KHERJA_DEV: '1' }); assert.notEqual(r.code, 0); assert.notEqual(r.code, 'timeout'); assert.match(r.err, /refusing to start/); assert.doesNotMatch(r.out, /kherja api on/); fs.rmSync(r.dir, { recursive: true, force: true }); });
test('process: KHERJA_DEV_ADMIN=1 without KHERJA_DEV exits non-zero', async () => {
  const r = await run({ KHERJA_DEV_ADMIN: '1' }); assert.notEqual(r.code, 0); assert.match(r.err, /refusing to start/); fs.rmSync(r.dir, { recursive: true, force: true }); });
test('process: no env flags starts in secure mode and rejects OTP 123456 and dev admin over real HTTP', async () => {
  const r = await run({}, { waitFor: /kherja api on/ }); try {
    assert.ok(r.p, 'server should have started: ' + r.err); const m = r.out().match(/on ([^:]+):(\d+) \((.+)\)/); assert.equal(m[3], 'secure mode'); const base = `http://127.0.0.1:${m[2]}`;
    const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    assert.equal((await post('/api/auth/otp', { phone: '0555000333' })).status, 503); // Phase 2.1: secure mode without an SMS sender says so (was 200)
    assert.equal((await post('/api/auth/verify', { phone: '0555000333', code: '123456' })).status, 400);
    assert.equal((await post('/api/admin/login', ADMIN)).status, 401);
    assert.equal((await post('/api/dev/role', { role: 'driver' })).status, 404);
  } finally { r.p && r.p.kill(); fs.rmSync(r.dir, { recursive: true, force: true }); } });
test('process: KHERJA_DEV=1 KHERJA_DEV_ADMIN=1 starts in DEV MODE on loopback only and OTP 123456 works', async () => {
  const r = await run({ KHERJA_DEV: '1', KHERJA_DEV_ADMIN: '1' }, { waitFor: /kherja api on/ }); try {
    assert.ok(r.p, 'server should have started: ' + r.err); const m = r.out().match(/on ([^:]+):(\d+) \((.+)\)/); assert.equal(m[1], '127.0.0.1'); assert.equal(m[3], 'DEV MODE'); const base = `http://127.0.0.1:${m[2]}`;
    const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    await post('/api/auth/otp', { phone: '0555000444' }); assert.equal((await post('/api/auth/verify', { phone: '0555000444', code: '123456' })).status, 200);
    assert.equal((await post('/api/admin/login', ADMIN)).status, 200);
  } finally { r.p && r.p.kill(); fs.rmSync(r.dir, { recursive: true, force: true }); } });
