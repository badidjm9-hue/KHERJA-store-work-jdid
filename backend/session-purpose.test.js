// Phase 2.1 / F-1: session purposes. OTP sessions ('user') never authorise admin endpoints; admin sessions ('admin') exist only after the admin
// password check and never authorise rider/driver endpoints. Run: node --test backend/session-purpose.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createApp } = require('./server');

const ADMIN_DEV = { phone: '0550000000', password: 'admin-dev-pass' };
const ADMIN_SEC = { phone: '0661000001', password: 'S3cure-Admin-pass!' };
const ADMIN_ENDPOINTS = [['GET', '/api/admin/me'], ['GET', '/api/admin/stats'], ['GET', '/api/admin/drivers'], ['GET', '/api/admin/rides'], ['GET', '/api/admin/reports'], ['GET', '/api/admin/drivers/1'], ['GET', '/api/admin/docs/1/file'], ['POST', '/api/admin/docs/1/review', { status: 'approved' }], ['POST', '/api/admin/drivers/1/suspend', { suspended: true }], ['GET', '/api/admin/rides/1'], ['POST', '/api/admin/reports/1', { status: 'closed' }]];
const USER_ENDPOINTS = [['GET', '/api/me'], ['GET', '/api/rides'], ['GET', '/api/rides/active'], ['GET', '/api/driver/me'], ['POST', '/api/safety/contacts', { name: 'x', phone: '0555000000' }]];

async function boot(opts = {}) {
  let t = Date.now(); const clock = { now: () => t, advance: ms => { t += ms; } };
  const sent = {}; const s = createApp({ dev: true, devAdmin: true, now: clock.now, ...opts, ...(opts.dev === false ? { sendSms: (p, c) => { sent[p] = c; } } : {}) });
  await new Promise(r => s.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + s.address().port;
  const call = async (m, p, b, ck) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j, h: r.headers }; };
  const tokOf = (r, name) => { const m = new RegExp(name + '=([^;]*)').exec(r.h.get('set-cookie') || ''); return m && m[1]; };
  /* OTP login (rider/driver/admin phone alike); in secure mode the code is whatever the injected sender captured */
  const otpLogin = async (phone, role = 'rider') => { await call('POST', '/api/auth/otp', { phone }); const norm = '+213' + phone.slice(1); const code = opts.dev === false ? sent[norm] : '123456'; const r = await call('POST', '/api/auth/verify', { phone, code, role }); assert.equal(r.s, 200); return { r, tok: tokOf(r, 'sid') }; };
  const adminLogin = async (a = ADMIN_DEV) => { const r = await call('POST', '/api/admin/login', a); return { r, tok: tokOf(r, 'asid') }; };
  return { s, base, call, tokOf, otpLogin, adminLogin, clock, stop: () => new Promise(r => s.close(r)) };
}
const asAsid = tok => 'asid=' + tok;
for (const [label, opts, adm] of [['dev mode', {}, ADMIN_DEV], ['secure mode', { dev: false, devAdmin: false, admin: ADMIN_SEC }, ADMIN_SEC]]) {
  const secure = label === 'secure mode';

  test(`[${label}] 1. admin-account OTP token used as asid → 401 on every admin endpoint`, async () => {
    const b = await boot(opts); try { const { r, tok } = await b.otpLogin(adm.phone); assert.equal(r.j.user.role, 'admin'); assert.ok(tok);
      for (const [m, p, body] of ADMIN_ENDPOINTS) assert.equal((await b.call(m, p, body, asAsid(tok))).s, 401, 'asid=<admin OTP token> must not open ' + p);
    } finally { await b.stop(); } });

  test(`[${label}] 2. rider OTP token used as asid → 401`, async () => {
    const b = await boot(opts); try { const { tok } = await b.otpLogin('0555810001', 'rider');
      for (const [m, p, body] of ADMIN_ENDPOINTS) assert.equal((await b.call(m, p, body, asAsid(tok))).s, 401, p);
    } finally { await b.stop(); } });

  test(`[${label}] 3. driver OTP token used as asid → 401`, async () => {
    const b = await boot(opts); try { const { tok } = await b.otpLogin('0555810002', 'driver');
      for (const [m, p, body] of ADMIN_ENDPOINTS) assert.equal((await b.call(m, p, body, asAsid(tok))).s, 401, p);
    } finally { await b.stop(); } });

  test(`[${label}] 4. correct admin password → valid admin-purpose session; wrong password → none`, async () => {
    const b = await boot(opts); try {
      const bad = await b.adminLogin({ ...adm, password: 'wrong-password' }); assert.equal(bad.r.s, 401); assert.equal(bad.tok, null);
      const { r, tok } = await b.adminLogin(adm); assert.equal(r.s, 200); assert.ok(tok && tok.length === 64);
      const sc = r.h.get('set-cookie'); assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Strict/); assert.equal(/Secure/.test(sc), secure);
      for (const [m, p] of [['GET', '/api/admin/me'], ['GET', '/api/admin/stats'], ['GET', '/api/admin/drivers'], ['GET', '/api/admin/rides'], ['GET', '/api/admin/reports']]) assert.equal((await b.call(m, p, null, asAsid(tok))).s, 200, p);
      const crypto = require('node:crypto'); const row = b.s.db.prepare('select kind from sessions where token_hash=?').get(crypto.createHash('sha256').update(tok).digest('hex')); assert.equal(row.kind, 'admin');
      const otpTok = (await b.otpLogin('0555810003')).tok; const row2 = b.s.db.prepare('select kind from sessions where token_hash=?').get(crypto.createHash('sha256').update(otpTok).digest('hex')); assert.equal(row2.kind, 'user');
    } finally { await b.stop(); } });

  test(`[${label}] 5. admin session used as an ordinary (sid) session → rejected everywhere (designed: admin sessions are admin-only)`, async () => {
    const b = await boot(opts); try { const { tok } = await b.adminLogin(adm);
      for (const [m, p, body] of USER_ENDPOINTS) assert.equal((await b.call(m, p, body, 'sid=' + tok)).s, 401, 'sid=<admin session> must not open ' + p);
      assert.equal((await b.call('POST', '/api/auth/logout', {}, 'sid=' + tok)).s, 401);
      assert.equal((await b.call('GET', '/api/admin/me', null, asAsid(tok))).s, 200, 'and it still works as the admin session');
    } finally { await b.stop(); } });

  test(`[${label}] 6. expired and revoked admin sessions are rejected`, async () => {
    const b = await boot(opts); try {
      const e = await b.adminLogin(adm); assert.equal((await b.call('GET', '/api/admin/me', null, asAsid(e.tok))).s, 200);
      b.clock.advance(12 * 3600e3 + 1000); assert.equal((await b.call('GET', '/api/admin/me', null, asAsid(e.tok))).s, 401, 'expired after 12 h');
      const v = await b.adminLogin(adm); assert.equal((await b.call('GET', '/api/admin/stats', null, asAsid(v.tok))).s, 200);
      assert.equal((await b.call('POST', '/api/admin/logout', {}, asAsid(v.tok))).s, 200); assert.equal((await b.call('GET', '/api/admin/stats', null, asAsid(v.tok))).s, 401, 'revoked by logout');
      const d = await b.adminLogin(adm); b.s.db.prepare("delete from sessions where kind='admin'").run(); assert.equal((await b.call('GET', '/api/admin/me', null, asAsid(d.tok))).s, 401, 'revoked by deleting the row');
    } finally { await b.stop(); } });

  test(`[${label}] 6b. an ordinary (OTP) logout does not revoke the admin session of the same account, and vice versa`, async () => {
    const b = await boot(opts); try { const a = await b.adminLogin(adm); const o = await b.otpLogin(adm.phone);
      assert.equal((await b.call('POST', '/api/auth/logout', {}, 'sid=' + o.tok)).s, 200); assert.equal((await b.call('GET', '/api/admin/me', null, asAsid(a.tok))).s, 200);
      const o2 = await b.otpLogin(adm.phone); await b.call('POST', '/api/admin/logout', {}, asAsid(a.tok)); assert.equal((await b.call('GET', '/api/me', null, 'sid=' + o2.tok)).s, 200);
    } finally { await b.stop(); } });
}

test('7. migration: a Phase 2 database (sessions without `kind`) keeps rider auth, loses no data, and admin endpoints stay protected', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-mig-')), dbPath = path.join(dir, 'old.db'); const crypto = require('node:crypto'); const sha = x => crypto.createHash('sha256').update(x).digest('hex');
  try {
    { const old = new DatabaseSync(dbPath); old.exec('pragma foreign_keys=on;'); old.exec(fs.readFileSync(path.join(__dirname, 'migrations', '001_init.sql'), 'utf8'));
      assert.ok(!old.prepare('pragma table_info(sessions)').all().some(c => c.name === 'kind'), 'fixture really has the OLD sessions table');
      old.prepare("insert into users(id,phone,name,role) values(1,'+213661000001','Admin','admin'),(2,'+213555820001','Old Rider','rider')").run();
      old.prepare('insert into sessions values(?,?,?)').run(sha('legacy-admin-token'), 1, Date.now() + 3600e3); old.prepare('insert into sessions values(?,?,?)').run(sha('legacy-rider-token'), 2, Date.now() + 3600e3); old.close(); }
    for (let round = 1; round <= 2; round++) { // second round proves the migration is idempotent
      const s = createApp({ dbPath, dev: false, admin: ADMIN_SEC }); await new Promise(r => s.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + s.address().port;
      const call = async (m, p, ck, b) => (await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined })).status;
      try {
        const col = s.db.prepare('pragma table_info(sessions)').all().find(c => c.name === 'kind'); assert.ok(col && col.notnull === 1 && col.dflt_value === "'user'", 'column added with default user');
        assert.equal(s.db.prepare('select count(*) c from users').get().c, 2, 'users preserved'); assert.equal(s.db.prepare("select count(*) c from sessions where token_hash in (?,?)").get(sha('legacy-admin-token'), sha('legacy-rider-token')).c, 2, 'sessions preserved');
        assert.equal(await call('GET', '/api/me', 'sid=legacy-rider-token'), 200, 'existing rider session still works');
        assert.equal(await call('GET', '/api/admin/me', 'asid=legacy-admin-token'), 401, 'a pre-migration admin session no longer works (re-login required)');
        assert.equal(await call('GET', '/api/admin/me', 'asid=legacy-rider-token'), 401);
        for (const [m, p, b] of ADMIN_ENDPOINTS) { assert.equal(await call(m, p, null, b), 401, 'no cookie: ' + p); assert.equal(await call(m, p, 'asid=legacy-admin-token', b), 401, 'legacy token: ' + p); }
        assert.equal(await call('POST', '/api/admin/login', null, { phone: ADMIN_SEC.phone, password: 'wrong' }), 401);
        const r = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ADMIN_SEC) }); assert.equal(r.status, 200);
        const tok = /asid=([^;]+)/.exec(r.headers.get('set-cookie'))[1]; assert.equal(await call('GET', '/api/admin/stats', 'asid=' + tok), 200);
      } finally { await new Promise(r => s.close(r)); }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } });
