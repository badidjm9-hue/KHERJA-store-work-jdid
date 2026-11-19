'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { resolveConfig, resolveClientIp, createApp } = require('./server');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-ops-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('PORT rejects malformed, fractional, negative and out-of-range values; permits ephemeral 0', () => {
  for (const PORT of ['abc', '1.5', '-1', '65536', ' 80']) assert.throws(() => resolveConfig({ PORT }), /invalid PORT/);
  assert.equal(resolveConfig({ PORT: '0' }).port, 0); assert.equal(resolveConfig({}).port, 8787);
  for (const HOST of ['bad host', 'http://localhost', 'bad_host']) assert.throws(() => resolveConfig({ HOST }), /invalid HOST/);
});
test('admin credentials must be paired, valid and strong in secure mode', () => {
  assert.throws(() => resolveConfig({ ADMIN_PHONE: '0555123456' }), /provided together/);
  assert.throws(() => resolveConfig({ ADMIN_PHONE: 'bad', ADMIN_PASSWORD: 'a'.repeat(20) }), /invalid ADMIN_PHONE/);
  assert.throws(() => resolveConfig({ ADMIN_PHONE: '0555123456', ADMIN_PASSWORD: 'short' }), /at least 16/);
  assert.equal(resolveConfig({ ADMIN_PHONE: '0555123456', ADMIN_PASSWORD: 'S'.repeat(20) }).admin.phone, '+213555123456');
});
test('busy timeout and trusted proxy allowlist are validated', () => {
  assert.throws(() => resolveConfig({ SQLITE_BUSY_TIMEOUT_MS: '-1' }), /invalid SQLITE_BUSY_TIMEOUT_MS/);
  assert.throws(() => resolveConfig({ TRUSTED_PROXY_IPS: '127.0.0.1,not-an-ip' }), /invalid TRUSTED_PROXY_IPS/);
  assert.equal(resolveConfig({ TRUSTED_PROXY_IPS: '127.0.0.1,::1' }).trustedProxyIps.length, 2);
});
test('forwarded headers are ignored unless the immediate peer is trusted', () => {
  assert.equal(resolveClientIp('198.51.100.4', '203.0.113.9', ['127.0.0.1']), '198.51.100.4');
  assert.equal(resolveClientIp('127.0.0.1', '198.51.100.7', ['127.0.0.1']), '198.51.100.7');
  assert.equal(resolveClientIp('127.0.0.1', 'not-an-ip', ['127.0.0.1']), '127.0.0.1');
  assert.equal(resolveClientIp('::ffff:127.0.0.1', '203.0.113.8', ['127.0.0.1']), '203.0.113.8');
});
test('close callback fires after SQLite is closed', async () => {
  const app = createApp({ dev: true, devAdmin: true }); await new Promise(r => app.listen(0, '127.0.0.1', r));
  await new Promise(r => app.close(r)); assert.throws(() => app.db.prepare('select 1').get());
});
test('health endpoint checks the database and returns healthy status', async () => {
  const app = createApp({ dev: true, devAdmin: true }); await new Promise(r => app.listen(0, '127.0.0.1', r));
  try { const res = await fetch(`http://127.0.0.1:${app.address().port}/api/health`); assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true, db: 'ok' }); }
  finally { await new Promise(r => app.close(r)); }
});
test('backup and restore scripts preserve DB and uploads and refuse overwrite', async () => {
  const db = path.join(tmp, 'source.db'), uploads = path.join(tmp, 'source-uploads'); fs.mkdirSync(uploads); fs.writeFileSync(path.join(uploads, 'doc.jpg'), Buffer.from([1,2,3]));
  const app = createApp({ dbPath: db, uploadDir: uploads, dev: true, devAdmin: true }); app.db.exec('create table backup_probe(v text); insert into backup_probe values (\'ok\')');
  await new Promise(r => app.close(r));
    const backup = path.join(tmp, 'backup'); const b = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts/backup.js'), backup], { cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: db, UPLOAD_DIR: uploads }, encoding: 'utf8' });
    assert.equal(b.status, 0, b.stderr); const target = path.join(tmp, 'restored');
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts/restore.js'), backup, target], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(target, 'uploads/doc.jpg')).toString('hex'), '010203');
    const { DatabaseSync } = require('node:sqlite'); const restored = new DatabaseSync(path.join(target, 'source.db')); assert.equal(restored.prepare('select v from backup_probe').get().v, 'ok'); restored.close();
  const again = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts/restore.js'), backup, target], { encoding: 'utf8' }); assert.equal(again.status, 1); assert.match(again.stderr, /already exists/);
});

// ---- Phase 2.3 final validation: regression tests for verified defects ----
const SCRIPTS = path.join(__dirname, '..', 'scripts');
const runScript = (name, args, env = {}) => spawnSync(process.execPath, [path.join(SCRIPTS, name), ...args], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
const { DatabaseSync: Sqlite } = require('node:sqlite');
const seedLive = (dir) => { fs.mkdirSync(dir); const db = path.join(dir, 'live.db'), up = path.join(dir, 'uploads'); const app = createApp({ dbPath: db, uploadDir: up, dev: true, devAdmin: true });
  app.db.exec("create table wal_probe(v text); insert into wal_probe values ('only-in-wal')"); fs.writeFileSync(path.join(up, 'a.png'), Buffer.from([9, 8, 7])); return { app, db, up }; };

test('HOST: dotted names whose last label is numeric are rejected (e.g. 999.999.999.999)', () => {
  for (const HOST of ['999.999.999.999', '1.2.3', '123', 'a.b.123']) assert.throws(() => resolveConfig({ HOST }), /invalid HOST/);
  for (const HOST of ['localhost', 'kherja.example.com', '127.0.0.1', '::1', '0.0.0.0']) assert.equal(resolveConfig({ HOST }).host, HOST);
});

test('UPLOAD_DIR must not equal or contain DB_PATH (config and createApp, no side effects)', () => {
  const d = path.join(tmp, 'cfg-up'); const dbp = path.join(d, 'k.db');
  for (const UPLOAD_DIR of [d, path.dirname(d), dbp]) assert.throws(() => resolveConfig({ DB_PATH: dbp, UPLOAD_DIR }), /invalid UPLOAD_DIR/);
  assert.equal(resolveConfig({ DB_PATH: dbp, UPLOAD_DIR: path.join(d, 'uploads') }).uploadDir, path.join(d, 'uploads'));
  assert.throws(() => createApp({ dbPath: dbp, uploadDir: d, dev: true, devAdmin: true }), /invalid uploadDir/);
  assert.equal(fs.existsSync(d), false, 'rejected config must not create the data directory or database');
});

test('backup taken while WAL is active contains WAL-only rows; snapshot is 0600; restore round-trips', async () => {
  const { app, db, up } = seedLive(path.join(tmp, 'wal-live'));
  try {
    assert.ok(fs.existsSync(db + '-wal') && fs.statSync(db + '-wal').size > 0, 'WAL must be active and non-empty');
    const backup = path.join(tmp, 'wal-backup'); const b = runScript('backup.js', [backup], { DB_PATH: db, UPLOAD_DIR: up }); assert.equal(b.status, 0, b.stderr);
    assert.equal((fs.statSync(path.join(backup, 'database.sqlite')).mode & 0o777).toString(8), '600');
    assert.equal((fs.statSync(path.join(backup, 'manifest.json')).mode & 0o777).toString(8), '600');
    const target = path.join(tmp, 'wal-restored'); const r = runScript('restore.js', [backup, target]); assert.equal(r.status, 0, r.stderr);
    const d = new Sqlite(path.join(target, 'live.db'), { readOnly: true }); try { assert.equal(d.prepare('select v from wal_probe').get().v, 'only-in-wal'); assert.equal(d.prepare('pragma integrity_check').get().integrity_check, 'ok'); } finally { d.close(); }
    assert.equal(fs.readFileSync(path.join(target, 'uploads', 'a.png')).toString('hex'), '090807');
  } finally { await new Promise(r => app.close(r)); }
});

test('backup refuses a destination inside the upload dir and an UPLOAD_DIR that contains the database; creates nothing', async () => {
  const { app, db, up } = seedLive(path.join(tmp, 'pv-live')); const parent = path.dirname(db);
  try {
    const inside = path.join(up, 'nested-backup'); const a = runScript('backup.js', [inside], { DB_PATH: db, UPLOAD_DIR: up });
    assert.equal(a.status, 1); assert.match(a.stderr, /inside the upload directory/); assert.deepEqual(fs.readdirSync(up), ['a.png']);
    const b = runScript('backup.js', [path.join(tmp, 'pv-out')], { DB_PATH: db, UPLOAD_DIR: parent });
    assert.equal(b.status, 1); assert.match(b.stderr, /must not equal or contain the database/); assert.equal(fs.existsSync(path.join(tmp, 'pv-out')), false);
    const viaLink = path.join(tmp, 'pv-link'); fs.symlinkSync(up, viaLink); const c = runScript('backup.js', [path.join(viaLink, 'nested2')], { DB_PATH: db, UPLOAD_DIR: up });
    assert.equal(c.status, 1, 'symlinked path into the upload dir must be resolved'); assert.deepEqual(fs.readdirSync(up), ['a.png']);
  } finally { await new Promise(r => app.close(r)); }
});

test('backup and restore refuse an existing or dangling-symlink destination with a clear message and leave nothing behind', async () => {
  const { app, db, up } = seedLive(path.join(tmp, 'ow-live'));
  try {
    const dangling = path.join(tmp, 'ow-dangling'); fs.symlinkSync(path.join(tmp, 'ow-nowhere'), dangling);
    const a = runScript('backup.js', [dangling], { DB_PATH: db, UPLOAD_DIR: up }); assert.equal(a.status, 1); assert.match(a.stderr, /already exists/);
    const good = path.join(tmp, 'ow-good'); assert.equal(runScript('backup.js', [good], { DB_PATH: db, UPLOAD_DIR: up }).status, 0);
    const dangling2 = path.join(tmp, 'ow-dangling2'); fs.symlinkSync(path.join(tmp, 'ow-nowhere2'), dangling2);
    const b = runScript('restore.js', [good, dangling2]); assert.equal(b.status, 1); assert.match(b.stderr, /already exists/);
    assert.ok(fs.lstatSync(dangling).isSymbolicLink() && fs.lstatSync(dangling2).isSymbolicLink());
    assert.deepEqual(fs.readdirSync(tmp).filter(n => /\.tmp-|\.restore-/.test(n)), []);
    const c = runScript('restore.js', [good, path.join(good, 'restored-inside')]); assert.equal(c.status, 1); assert.match(c.stderr, /inside the backup directory/);
    assert.equal(fs.existsSync(path.join(good, 'restored-inside')), false);
  } finally { await new Promise(r => app.close(r)); }
});

test('restore rejects a symlinked uploads directory and unsafe database basenames; failures leave no target or staging dir', async () => {
  const { app, db, up } = seedLive(path.join(tmp, 'rs-live'));
  try {
    const good = path.join(tmp, 'rs-good'); assert.equal(runScript('backup.js', [good], { DB_PATH: db, UPLOAD_DIR: up }).status, 0);
    const outDir = path.join(tmp, 'rs-out'); fs.mkdirSync(outDir);
    const clone = n => { const d = path.join(tmp, 'rs-' + n); fs.cpSync(good, d, { recursive: true }); return d; };
    const linked = clone('linked'); fs.renameSync(path.join(linked, 'uploads'), path.join(tmp, 'rs-elsewhere')); fs.symlinkSync(path.join(tmp, 'rs-elsewhere'), path.join(linked, 'uploads'));
    const a = runScript('restore.js', [linked, path.join(outDir, 'a')]); assert.equal(a.status, 1); assert.match(a.stderr, /real directory/);
    for (const name of ['..', '.', '.hidden', '../evil.db', 'a/b']) {
      const d = clone('b' + name.replace(/\W/g, '_')); const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8')); m.source_db_basename = name; fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(m));
      const r = runScript('restore.js', [d, path.join(outDir, 'b')]); assert.equal(r.status, 1, name); assert.match(r.stderr, /invalid backup manifest/, name);
    }
    assert.deepEqual(fs.readdirSync(outDir), [], 'no target and no .restore-* staging may remain');
  } finally { await new Promise(r => app.close(r)); }
});
