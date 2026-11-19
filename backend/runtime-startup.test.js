// Startup wiring: proves backend/server.js, run as a process, enforces the Node pin BEFORE opening the database.
// The helper functions are covered by runtime.test.js; this file covers the process entry point.
// The Node version is spoofed through a preload script, so these tests run on any Node version.
// Run: node --test backend/runtime-startup.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'); const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { EXPECTED_NODE } = require('./runtime');
const SERVER = path.join(__dirname, 'server.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-start-')); test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const preload = path.join(tmp, 'fake-version.js'); fs.writeFileSync(preload, "Object.defineProperty(process,'version',{value:process.env.FAKE_NODE_VERSION,configurable:true});");

// Runs server.js; resolves on exit, or once `until` matches output (then kills the child).
function start(env, { fake, until } = {}) {
  const clean = { PATH: process.env.PATH, ...env }; if (fake) clean.FAKE_NODE_VERSION = fake;
  const args = fake ? ['-r', preload, SERVER] : [SERVER];
  return new Promise((resolve, reject) => { const c = spawn(process.execPath, args, { env: clean }); let out = '', err = '', done = false;
    const fin = (code, killed) => { if (done) return; done = true; clearTimeout(t); resolve({ code, out, err, killed }); };
    const t = setTimeout(() => { c.kill('SIGKILL'); reject(new Error('timeout; out=' + out + ' err=' + err)); }, 15000);
    const chk = () => { if (until && until.test(out)) { c.kill('SIGKILL'); fin(null, true); } };
    c.stdout.on('data', d => { out += d; chk(); }); c.stderr.on('data', d => { err += d; }); c.on('exit', code => fin(code, false)); });
}
const dbFile = n => path.join(tmp, n);
const exists = f => ['', '-wal', '-shm', '-journal'].some(s => fs.existsSync(f + s));
const SECRET = 'S3cret-Marker-Value-9f2c';
const PROD = (db, extra = {}) => ({ NODE_ENV: 'production', PORT: '0', HOST: '127.0.0.1', DB_PATH: db, ADMIN_PHONE: '0550123456', ADMIN_PASSWORD: SECRET, ...extra });

test('production on an unsupported Node exits 1 before the database is opened and leaks no secret', async () => {
  const db = dbFile('prod-unsupported.db'); const r = await start(PROD(db), { fake: 'v24.0.0' });
  assert.equal(r.code, 1); assert.match(r.err, /unsupported Node\.js v24\.0\.0/); assert.match(r.err, new RegExp('pinned to ' + EXPECTED_NODE.replace(/\./g, '\\.')));
  assert.equal(exists(db), false, 'the SQLite file must not be created when the runtime is rejected');
  assert.ok(!r.out.includes('kherja api on'), 'server must not listen');
  assert.ok(!(r.out + r.err).includes(SECRET), 'admin password must never be printed');
});

test('development on an unsupported Node warns and still starts', async () => {
  const r = await start({ KHERJA_DEV: '1', PORT: '0', DB_PATH: ':memory:' }, { fake: 'v24.0.0', until: /kherja api on 127\.0\.0\.1:\d+ \(DEV MODE\)/ });
  assert.equal(r.killed, true, 'dev server should start; out=' + r.out + ' err=' + r.err); assert.match(r.err, /unsupported Node\.js v24\.0\.0.*development only; continuing/);
});

test('production on the pinned Node starts in secure mode', { skip: process.version === EXPECTED_NODE ? false : `running on ${process.version}, not the pinned ${EXPECTED_NODE}` }, async () => {
  const db = dbFile('prod-supported.db'); const r = await start(PROD(db), { until: /kherja api on 127\.0\.0\.1:\d+ \(secure mode\)/ });
  assert.equal(r.killed, true, 'secure server should start; out=' + r.out + ' err=' + r.err); assert.ok(!(r.out + r.err).includes(SECRET), 'admin password must never be printed');
});

test('production refuses KHERJA_DEV even on the pinned Node, before the database is opened', async () => {
  const db = dbFile('prod-dev-flag.db'); const r = await start(PROD(db, { KHERJA_DEV: '1' }));
  assert.equal(r.code, 1); assert.match(r.err, /must not be set when NODE_ENV=production/); assert.equal(exists(db), false);
});
