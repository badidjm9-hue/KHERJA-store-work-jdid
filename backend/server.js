'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { DatabaseSync } = require('node:sqlite');
const { quoteFare, distanceKm: fareDistanceKm, MIN_FARE } = require('./fare');

const REQ_DOCS = ['vehicle_photo', 'license', 'registration', 'insurance'];
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + '$' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
const checkPw = (pw, stored) => { const [salt, h] = String(stored || '').split('$'); if (!salt || !h) return false; const x = crypto.scryptSync(String(pw ?? ''), salt, 32), y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sniff = buf => buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'image/jpeg' : buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'image/png' : (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') ? 'image/webp' : null;
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const PHONE = /^\+?213?0?[567]\d{8}$|^0[567]\d{8}$/;
const normPhone = p => { const d = String(p || '').replace(/\D/g, ''); const m = d.match(/(?:213|0)?([567]\d{8})$/); return m ? '+213' + m[1] : null; };

// Development-only credentials. They are only usable when BOTH dev mode and dev-admin mode are explicitly enabled.
const DEV_ADMIN = { phone: '0550000000', password: 'admin-dev-pass' };
const LOOPBACK = ['127.0.0.1', '::1', 'localhost'];
// True when `child` is `parent` itself or lives below it (lexical, after path.resolve).
function isInside(parent, child) { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)); }
function resolveClientIp(remoteAddress, forwardedFor, trustedProxyIps = []) {
  const rawPeer = String(remoteAddress || '');
  const peer = rawPeer.replace(/^::ffff:/i, '');
  const trusted = new Set(trustedProxyIps.map(ip => String(ip).toLowerCase()));
  if (!trusted.has(peer.toLowerCase()) && !trusted.has(rawPeer.toLowerCase())) return peer || 'unknown';
  const chain = String(forwardedFor || '').split(',').map(x => x.trim());
  const candidate = chain.length ? chain[chain.length - 1] : '';
  return net.isIP(candidate) ? candidate.replace(/^::ffff:/i, '') : peer || 'unknown';
}
// Pure function: turns environment variables into a validated server config, or throws (startup must then abort).
function resolveConfig(env = process.env) {
  const on = v => v === '1' || v === 'true';
  const prod = env.NODE_ENV === 'production';
  const dev = on(env.KHERJA_DEV), devAdmin = on(env.KHERJA_DEV_ADMIN);
  if (prod && (dev || devAdmin)) throw new Error('refusing to start: KHERJA_DEV / KHERJA_DEV_ADMIN must not be set when NODE_ENV=production');
  if (devAdmin && !dev) throw new Error('refusing to start: KHERJA_DEV_ADMIN requires KHERJA_DEV=1');
  const host = env.HOST || (dev ? '127.0.0.1' : '0.0.0.0');
  if (dev && !LOOPBACK.includes(host)) throw new Error('refusing to start: dev mode may only listen on a loopback address (got HOST=' + host + ')');
  const rawPort = env.PORT === undefined || env.PORT === '' ? '8787' : String(env.PORT);
  if (!/^(0|[1-9]\d{0,4})$/.test(rawPort) || Number(rawPort) > 65535) throw new Error('invalid PORT: expected an integer from 0 to 65535');
  if (typeof host !== 'string' || !host || /\s/.test(host) || host.length > 253 || (net.isIP(host) === 0 && (/(^|\.)\d+$/.test(host) || (host !== 'localhost' && !/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(host))))) throw new Error('invalid HOST');
  const rawDbPath = env.DB_PATH || 'kherja.db';
  if (typeof rawDbPath !== 'string' || !rawDbPath.trim()) throw new Error('invalid DB_PATH');
  const hasPhone = Boolean(env.ADMIN_PHONE), hasPassword = Boolean(env.ADMIN_PASSWORD);
  if (hasPhone !== hasPassword) throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be provided together');
  let admin = null;
  if (hasPhone) {
    const phone = normPhone(env.ADMIN_PHONE);
    if (!phone) throw new Error('invalid ADMIN_PHONE');
    if (!dev && String(env.ADMIN_PASSWORD).length < 16) throw new Error('ADMIN_PASSWORD must be at least 16 characters in secure mode');
    admin = { phone, password: env.ADMIN_PASSWORD };
  }
  const busyTimeout = env.SQLITE_BUSY_TIMEOUT_MS === undefined || env.SQLITE_BUSY_TIMEOUT_MS === '' ? 5000 : Number(env.SQLITE_BUSY_TIMEOUT_MS);
  if (!Number.isInteger(busyTimeout) || busyTimeout < 0 || busyTimeout > 60000) throw new Error('invalid SQLITE_BUSY_TIMEOUT_MS (0..60000)');
  const trustedProxyIps = String(env.TRUSTED_PROXY_IPS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (trustedProxyIps.some(ip => net.isIP(ip) === 0)) throw new Error('invalid TRUSTED_PROXY_IPS: use comma-separated IP addresses');
  const uploadDir = env.UPLOAD_DIR ? path.resolve(env.UPLOAD_DIR) : null;
  if (uploadDir && rawDbPath !== ':memory:' && isInside(uploadDir, rawDbPath)) throw new Error('invalid UPLOAD_DIR: it must not equal or contain DB_PATH');
  return { prod, dev, devAdmin, host, port: Number(rawPort), dbPath: rawDbPath === ':memory:' ? rawDbPath : path.resolve(rawDbPath), uploadDir, busyTimeout, trustedProxyIps, admin };
}

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (m) => new HttpError(400, m), deny = () => new HttpError(403, 'forbidden'), nf = () => new HttpError(404, 'not found');
const int = (v, lo, hi, name) => { if (!Number.isInteger(v) || v < lo || v > hi) throw bad(name + ' invalid'); return v; };
const str = (v, max, name, req = true) => { if (v == null || v === '') { if (req) throw bad(name + ' required'); return null; } if (typeof v !== 'string' || v.length > max) throw bad(name + ' invalid'); return v; };
const geo = (o, name) => { if (!o || typeof o.lat !== 'number' || typeof o.lng !== 'number' || Math.abs(o.lat) > 90 || Math.abs(o.lng) > 180) throw bad(name + ' invalid'); return { lat: o.lat, lng: o.lng, label: str(o.label, 120, name + '.label') }; };

function createApp({ dbPath = ':memory:', dev = false, devAdmin = false, now = () => Date.now(), requireApproval = !dev, admin = null, uploadDir = null, sendSms = null, trustedProxyIps = [], busyTimeout = 5000, redirectLegacy = !dev } = {}) {
  if (dev && process.env.NODE_ENV === 'production') throw new Error('refusing to start: dev mode is not allowed when NODE_ENV=production');
  if (devAdmin && !dev) throw new Error('refusing to start: devAdmin requires dev mode');
  if (!Number.isInteger(busyTimeout) || busyTimeout < 0 || busyTimeout > 60000) throw new Error('invalid busyTimeout');
  if (!Array.isArray(trustedProxyIps) || trustedProxyIps.some(ip => net.isIP(ip) === 0)) throw new Error('invalid trustedProxyIps');
  if (uploadDir && dbPath !== ':memory:' && isInside(uploadDir, dbPath)) throw new Error('invalid uploadDir: it must not equal or contain the database file');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`pragma foreign_keys=on; pragma journal_mode=wal; pragma busy_timeout=${busyTimeout};`);
  if (dbPath !== ':memory:') { try { fs.chmodSync(dbPath, 0o600); } catch {} }
  db.exec(fs.readFileSync(path.join(__dirname, 'migrations', '001_init.sql'), 'utf8'));
  { const cols = db.prepare('pragma table_info(requests)').all().map(c => c.name);
    for (const [c, d] of [['kind', "text not null default 'ride'"], ['item_type', 'text'], ['item_note', 'text'], ['recipient_name', 'text'], ['recipient_phone', 'text'], ['vehicle_type', "text not null default 'car' check(vehicle_type in('car','moto'))"]]) if (!cols.includes(c)) db.exec(`alter table requests add column ${c} ${d}`); }
  db.exec(fs.readFileSync(path.join(__dirname, 'migrations', '002_admin.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(__dirname, 'migrations', '003_notifications.sql'), 'utf8'));
  { const has = c => db.prepare('pragma table_info(rides)').all().some(x => x.name === c);
    if (!has('payment_method')) db.exec("alter table rides add column payment_method text not null default 'cash' check(payment_method in('cash'))");
    if (!has('payment_status')) db.exec("alter table rides add column payment_status text not null default 'pending' check(payment_status in('pending','paid'))");
    if (!has('paid_at')) db.exec('alter table rides add column paid_at text');
    db.exec(`create index if not exists idx_rides_cash_due on rides(payment_status, status);
      create trigger if not exists ride_payment_method_immutable before update of payment_method on rides when old.payment_method<>new.payment_method begin select raise(abort,'payment_method is immutable'); end;
      create trigger if not exists ride_payment_status_transition before update of payment_status on rides when not (old.payment_status='pending' and new.payment_status='paid') and old.payment_status<>new.payment_status begin select raise(abort,'invalid payment status transition'); end;`);
  }
  { const has = (t, c) => db.prepare(`pragma table_info(${t})`).all().some(x => x.name === c);
    for (const [t, c, d] of [['drivers', 'vehicle_type', "text not null default 'car'"], ['drivers', 'suspended', 'integer not null default 0'], ['users', 'password_hash', 'text'], ['sessions', 'kind', "text not null default 'user' check(kind in('user','admin'))"]]) if (!has(t, c)) db.exec(`alter table ${t} add column ${c} ${d}`); }
  const OFFER_TTL_MS = 15000;
  { const has = (t, c) => db.prepare(`pragma table_info(${t})`).all().some(x => x.name === c);
    // M0: fail-closed vehicle lock. Only a provably pristine driver is unlocked, in the same transaction as the column add.
    if (!has('drivers', 'vehicle_locked')) {
      db.exec('begin immediate');
      try {
        db.exec('alter table drivers add column vehicle_locked integer not null default 1');
        db.exec(`update drivers set vehicle_locked=0 where docs_status='pending' and suspended=0 and online=0 and lat is null and lng is null
          and not exists(select 1 from driver_docs x where x.user_id=drivers.user_id)
          and not exists(select 1 from audit a where a.target='user:'||drivers.user_id or a.target like '% user:'||drivers.user_id or a.target like 'user:'||drivers.user_id||' %')
          and not exists(select 1 from rides r where r.driver_id=drivers.user_id) and not exists(select 1 from offers o where o.driver_id=drivers.user_id)`);
        db.exec('commit');
      } catch (e) { db.exec('rollback'); throw e; }
    }
    // Offer expiry: one authoritative server timestamp per offer. Legacy pending offers get 0 (= already expired, fail closed).
    if (!has('offers', 'expires_at')) db.exec('alter table offers add column expires_at integer not null default 0');
    db.exec(`
      create table if not exists driver_change_requests(id integer primary key, user_id integer not null references users(id) on delete cascade,
        vehicle_type text not null check(vehicle_type in('car','moto')), car text not null, plate text not null, plate_norm text not null,
        prev_vehicle_type text not null, prev_car text not null, prev_plate text not null,
        status text not null default 'pending' check(status in('pending','approved','rejected','cancelled','superseded')),
        reason text, decided_by integer references users(id), decided_at text, created_at text not null default (datetime('now')));
      create unique index if not exists one_pending_change_per_driver on driver_change_requests(user_id) where status='pending';
      create unique index if not exists one_pending_plate_norm on driver_change_requests(plate_norm) where status='pending';
      create table if not exists driver_change_events(id integer primary key, request_id integer, user_id integer not null,
        action text not null check(action in('requested','superseded','cancelled','approved','rejected')),
        actor_role text not null check(actor_role in('driver','admin')), actor_id integer not null, fields text, created_at text not null default (datetime('now')));
      create index if not exists idx_dce_user on driver_change_events(user_id);
      create trigger if not exists dce_no_update before update on driver_change_events begin select raise(abort,'driver_change_events is append-only'); end;
      create trigger if not exists dce_no_delete before delete on driver_change_events begin select raise(abort,'driver_change_events is append-only'); end;
      create trigger if not exists dcr_plate_taken before insert on driver_change_requests when new.status='pending' and exists(select 1 from drivers where plate=new.plate and user_id<>new.user_id)
        begin select raise(abort,'plate_taken'); end;
      create trigger if not exists drv_plate_pending_ins before insert on drivers when exists(select 1 from driver_change_requests where status='pending' and plate=new.plate and user_id<>new.user_id)
        begin select raise(abort,'plate_taken'); end;
      create trigger if not exists drv_plate_pending_upd before update of plate on drivers when exists(select 1 from driver_change_requests where status='pending' and plate=new.plate and user_id<>new.user_id)
        begin select raise(abort,'plate_taken'); end;
      create trigger if not exists drv_type_ins before insert on drivers when new.vehicle_type not in('car','moto') begin select raise(abort,'vehicle_type invalid'); end;
      create trigger if not exists drv_type_upd before update of vehicle_type on drivers when new.vehicle_type not in('car','moto') begin select raise(abort,'vehicle_type invalid'); end;
      create trigger if not exists offer_expiry_immutable before update of expires_at on offers begin select raise(abort,'offer expires_at is immutable'); end;
      create index if not exists idx_off_exp on offers(status, expires_at);
      create trigger if not exists vehicle_lock_irreversible before update of vehicle_locked on drivers when old.vehicle_locked=1 and new.vehicle_locked<>1 begin select raise(abort,'vehicle_locked is irreversible'); end;
    `); }
  const upDir = uploadDir ? path.resolve(uploadDir) : (dbPath === ':memory:' ? fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-up-')) : path.join(path.dirname(path.resolve(dbPath)), 'uploads'));
  fs.mkdirSync(upDir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(upDir, 0o700); } catch {}
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const notify = (uid, kind, ref, detail) => { try { run('insert into notifications(user_id,kind,ref_id,detail) values(?,?,?,?)', uid, kind, ref ?? null, detail ?? null); } catch {} };
  const tx = fn => { db.exec('begin immediate'); try { const r = fn(); db.exec('commit'); return r; } catch (e) { try { db.exec('rollback'); } catch {} throw e; } };

  const lockVehicle = uid => run('update drivers set vehicle_locked=1 where user_id=?', uid);
  const normPlate = p => String(p || '').normalize('NFKC').replace(/[\u0660-\u0669]/g, c => c.charCodeAt(0) - 0x660).replace(/[\u06f0-\u06f9]/g, c => c.charCodeAt(0) - 0x6f0).replace(/[\s\-_.]/g, '').toUpperCase();
  const plateTaken = (plate, uid) => { const n = normPlate(plate);
    return all('select plate from drivers where user_id<>?', uid).some(r => normPlate(r.plate) === n) || !!q("select 1 from driver_change_requests where status='pending' and plate_norm=? and user_id<>?", n, uid); };
  const ev = (rid, uid, action, actorRole, actorId, fields) => run('insert into driver_change_events(request_id,user_id,action,actor_role,actor_id,fields) values(?,?,?,?,?,?)', rid, uid, action, actorRole, actorId, fields || null);
  // Expire parent requests and their pending offers together; then expire standalone offer deadlines.
  const expireRequests = () => tx(() => {
    const ts = now();
    const expired = all("select id from requests where status='open' and expires_at<=?", ts);
    for (const r of expired) {
      run("update offers set status='expired' where request_id=? and status='pending'", r.id);
      run("update requests set status='expired' where id=? and status='open' and expires_at<=?", r.id, ts);
    }
    return expired.length;
  });
  const expireOffers = () => run("update offers set status='expired' where status='pending' and expires_at<=?", now());
  const sweepLifecycle = () => { expireRequests(); expireOffers(); };
  sweepLifecycle();
  const sweeper = setInterval(() => { try { sweepLifecycle(); } catch {} }, 1000); sweeper.unref();
  { const devAdminOn = dev && devAdmin;
    const cfg = admin || (process.env.ADMIN_PHONE && process.env.ADMIN_PASSWORD ? { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD } : null) || (devAdminOn ? DEV_ADMIN : null);
    if (cfg && cfg.password === DEV_ADMIN.password && !devAdminOn) throw new Error('refusing to start: the development admin password cannot be used unless dev mode and dev admin are both enabled');
    // A database created by an older version (or a dev run) may still hold the known dev password: neutralise it.
    if (!devAdminOn) for (const a of all("select id,password_hash from users where role='admin'")) if (checkPw(DEV_ADMIN.password, a.password_hash)) run('update users set password_hash=null where id=?', a.id);
    const ph = cfg && normPhone(cfg.phone); if (ph) { const ex = q('select id from users where phone=?', ph);
      if (ex) run("update users set role='admin',password_hash=? where id=?", hashPw(cfg.password), ex.id); else run("insert into users(phone,name,role,password_hash) values(?,?,?,?)", ph, 'Admin', 'admin', hashPw(cfg.password)); } }
  const clientIp = req => resolveClientIp(req.socket.remoteAddress, req.headers['x-forwarded-for'], trustedProxyIps);
  const hits = new Map(); // rate limit: key -> [timestamps]
  const limit = (key, max, windowMs) => { const t = now(); const a = (hits.get(key) || []).filter(x => t - x < windowMs); if (a.length >= max) throw new HttpError(429, 'too many requests'); a.push(t); hits.set(key, a); };

  const cookieOf = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(c => c[0]).map(([k, ...v]) => [k, v.join('=')]));
  const auth = req => { const tok = cookieOf(req).sid; if (!tok) throw new HttpError(401, 'login required'); const s = q("select user_id from sessions where token_hash=? and kind='user' and expires_at>?", sha(tok), now()); if (!s) throw new HttpError(401, 'login required'); return q('select * from users where id=?', s.user_id); };
  const authAdmin = req => { const tok = cookieOf(req).asid; if (!tok) throw new HttpError(401, 'login required');
    const s = q("select user_id from sessions where token_hash=? and kind='admin' and expires_at>?", sha(tok), now()); const u = s && q('select * from users where id=?', s.user_id);
    if (!u || u.role !== 'admin') throw new HttpError(401, 'login required'); return u; };
  const recalc = uid => { const docs = all('select kind,status from driver_docs where user_id=?', uid); let st = 'pending';
    if (docs.some(d => d.status === 'rejected')) st = 'rejected'; else if (REQ_DOCS.every(k => docs.some(d => d.kind === k && d.status === 'approved'))) st = 'approved';
    run('update drivers set docs_status=? where user_id=?', st, uid); if (st === 'approved') lockVehicle(uid); if (st !== 'approved') run('update drivers set online=0 where user_id=?', uid); return st; };
  const fileOut = d => ({ __file: { buf: fs.readFileSync(path.join(upDir, d.file)), mime: d.mime } });
  const role = (u, r) => { if (u.role !== r) throw deny(); };

  const publicDriver = id => { const d = q(`select d.user_id id,u.name,d.car,d.plate,d.is_woman,
      coalesce((select round(avg(stars),1) from ratings where to_user=d.user_id),5.0) rating,
      (select count(*) from rides where driver_id=d.user_id and status='completed') rides,
      (select count(*) from rides where driver_id=d.user_id) total,
      (select count(*) from rides where driver_id=d.user_id and status='cancelled') cancelled
      from drivers d join users u on u.id=d.user_id where d.user_id=?`, id); if (d) { d.cancel_pct = d.total ? Math.round(100 * d.cancelled / d.total) : 0; delete d.total; delete d.cancelled; } return d; };

  const routes = [];
  const add = (method, re, fn) => routes.push({ method, re: new RegExp('^' + re + '$'), fn });

  /* ---- auth ---- */
  add('POST', '/api/auth/otp', async (req, b, ctx) => {
    const phone = normPhone(b.phone); if (!phone) throw bad('phone invalid');
    // Secure mode without an SMS sender: say so (503) instead of pretending a message was sent. No OTP is created.
    if (!dev && typeof sendSms !== 'function') throw new HttpError(503, 'sms_unavailable');
    limit('otp:' + phone, 3, 10 * 60e3); limit('otpip:' + ctx.ip, 20, 10 * 60e3);
    const code = dev ? '123456' : String(crypto.randomInt(100000, 1000000));
    run('insert into otps(phone,code_hash,expires_at,tries) values(?,?,?,0) on conflict(phone) do update set code_hash=excluded.code_hash,expires_at=excluded.expires_at,tries=0', phone, sha(phone + code), now() + 5 * 60e3);
    if (!dev) { // sendSms(phone, code) is an asynchronous provider hook supplied by the host; it must throw on failure. The code is never logged or returned.
      try { await sendSms(phone, code); } catch { run('delete from otps where phone=?', phone); throw new HttpError(502, 'sms_failed'); } }
    return dev ? { ok: true, dev: true } : { ok: true };
  });
  add('POST', '/api/auth/verify', (req, b, ctx) => {
    const phone = normPhone(b.phone); if (!phone) throw bad('phone invalid');
    limit('ver:' + phone, 8, 10 * 60e3);
    const o = q('select * from otps where phone=?', phone);
    if (!o || o.expires_at < now() || o.tries >= 5) throw bad('code invalid');
    run('update otps set tries=tries+1 where phone=?', phone);
    const given = sha(phone + String(b.code || ''));
    if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(o.code_hash))) throw bad('code invalid');
    run('delete from otps where phone=?', phone);
    let u = q('select * from users where phone=?', phone);
    if (!u) {
      const r = b.role === 'driver' ? 'driver' : 'rider';
      const info = run('insert into users(phone,name,role,lang) values(?,?,?,?)', phone, str(b.name, 60, 'name', false), r, ['ar', 'fr', 'en'].includes(b.lang) ? b.lang : 'ar');
      u = q('select * from users where id=?', info.lastInsertRowid);
    }
    const tok = crypto.randomBytes(32).toString('hex');
    run("insert into sessions(token_hash,user_id,expires_at,kind) values(?,?,?,'user')", sha(tok), u.id, now() + 30 * 864e5);
    ctx.headers['Set-Cookie'] = `sid=${tok}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 86400}${dev ? '' : '; Secure'}`;
    return { user: { id: u.id, name: u.name, role: u.role, lang: u.lang } };
  });
  add('POST', '/api/auth/logout', (req, b, ctx) => { const u = auth(req); run("delete from sessions where user_id=? and kind='user'", u.id); ctx.headers['Set-Cookie'] = 'sid=; HttpOnly; Path=/; Max-Age=0'; return { ok: true }; });
  add('GET', '/api/me', req => { const u = auth(req); return { id: u.id, name: u.name, role: u.role, lang: u.lang, phone: u.phone }; });
  add('GET', '/api/me/export', req => { const u = auth(req);
    const user = q('select id,phone,name,role,lang,city,prefers_women,created_at from users where id=?', u.id);
    const rides = all(`select r.id,r.request_id,r.offer_id,r.rider_id,r.driver_id,r.status,r.locked_price,r.created_at,r.payment_method,r.payment_status,r.paid_at,
      x.kind,x.item_type,x.item_note,x.p_lat,x.p_lng,x.p_label,x.d_lat,x.d_lng,x.d_label,x.created_at request_created_at
      from rides r left join requests x on x.id=r.request_id where r.rider_id=? or r.driver_id=? order by r.id desc`, u.id, u.id);
    const ratings = all('select id,ride_id,from_user,to_user,stars,tags from ratings where from_user=? or to_user=? order by id desc', u.id, u.id);
    const contacts = all('select name,phone from safety_contacts where user_id=? order by id', u.id);
    const reports = all('select id,ride_id,kind,body,status,created_at from reports where reporter_id=? order by id desc', u.id);
    const driver = q('select car,plate,online,is_woman,docs_status,vehicle_type,suspended from drivers where user_id=?', u.id) || null;
    const driverChangeHistory = all('select action,actor_role,fields,created_at from driver_change_events where user_id=? order by id', u.id);
    const documentKinds = all('select kind,created_at from driver_docs where user_id=? order by id', u.id);
    return { export_version: 1, exported_at: new Date(now()).toISOString(), account: user, rides, ratings, safety_contacts: contacts, reports, driver_profile: driver, driver_change_history: driverChangeHistory, driver_document_metadata: documentKinds };
  });
  add('DELETE', '/api/me', (req, b, ctx) => { const u = auth(req); all('select file from driver_docs where user_id=?', u.id).forEach(o => { try { fs.unlinkSync(path.join(upDir, o.file)); } catch {} }); tx(() => { run('delete from ratings where from_user=? or to_user=?', u.id, u.id); run('delete from reports where reporter_id=?', u.id); run('delete from rides where rider_id=? or driver_id=?', u.id, u.id); run('delete from users where id=?', u.id); }); ctx.headers['Set-Cookie'] = 'sid=; HttpOnly; Path=/; Max-Age=0'; return { ok: true }; });

  /* ---- driver ---- */
  add('POST', '/api/driver/profile', (req, b) => { const u = auth(req); role(u, 'driver');
    if (b.vehicle_type !== undefined && !['car', 'moto'].includes(b.vehicle_type)) throw bad('vehicle_type invalid');
    if (b.is_woman !== undefined && ![true, false, 0, 1].includes(b.is_woman)) throw bad('is_woman invalid');
    const car = str(b.car, 60, 'car'), plate = str(b.plate, 20, 'plate').trim(), name = str(b.name, 60, 'name', false);
    if (!normPlate(plate)) throw bad('plate invalid');
    try { return tx(() => {
      if (name) run('update users set name=? where id=?', name, u.id);
      const d = q('select * from drivers where user_id=?', u.id), w = b.is_woman === undefined ? null : (b.is_woman ? 1 : 0);
      if (!d) { if (plateTaken(plate, u.id)) throw new HttpError(409, 'plate already registered');
        run('insert into drivers(user_id,car,plate,is_woman,vehicle_type,vehicle_locked) values(?,?,?,?,?,0)', u.id, car, plate, w ?? 0, b.vehicle_type ?? 'car'); return { ok: true, change: 'applied' }; }
      if (w !== null) run('update drivers set is_woman=? where user_id=?', w, u.id);
      const vt = b.vehicle_type ?? d.vehicle_type;
      if (vt === d.vehicle_type && car === d.car && plate === d.plate) return { ok: true, change: 'none' };
      if (!d.vehicle_locked) { if (plateTaken(plate, u.id)) throw new HttpError(409, 'plate already registered');
        run('update drivers set car=?,plate=?,vehicle_type=? where user_id=?', car, plate, vt, u.id); return { ok: true, change: 'applied' }; }
      limit('vchg:' + u.id, 10, 3600e3);
      if (plateTaken(plate, u.id)) throw new HttpError(409, 'plate already registered');
      const old = q("select id from driver_change_requests where user_id=? and status='pending'", u.id);
      if (old) { run("update driver_change_requests set status='superseded',decided_at=datetime('now') where id=?", old.id); ev(old.id, u.id, 'superseded', 'driver', u.id); }
      const i = run('insert into driver_change_requests(user_id,vehicle_type,car,plate,plate_norm,prev_vehicle_type,prev_car,prev_plate) values(?,?,?,?,?,?,?,?)', u.id, vt, car, plate, normPlate(plate), d.vehicle_type, d.car, d.plate);
      ev(Number(i.lastInsertRowid), u.id, 'requested', 'driver', u.id, [vt !== d.vehicle_type && 'type', car !== d.car && 'model', plate !== d.plate && 'plate'].filter(Boolean).join(','));
      return { ok: true, change: 'pending', request_id: Number(i.lastInsertRowid) }; }); }
    catch (e) { if (/UNIQUE|plate_taken/.test(e.message)) throw new HttpError(409, 'plate already registered'); throw e; } });
  add('POST', '/api/driver/vehicle-change/cancel', (req, b) => { const u = auth(req); role(u, 'driver'); const id = int(b.request_id, 1, 2 ** 53 - 1, 'request_id'); limit('vchg:' + u.id, 10, 3600e3);
    return tx(() => { const c = q('select * from driver_change_requests where id=? and user_id=?', id, u.id); if (!c) throw nf(); if (c.status !== 'pending') throw new HttpError(409, 'not pending');
      run("update driver_change_requests set status='cancelled',decided_at=datetime('now') where id=?", c.id); ev(c.id, u.id, 'cancelled', 'driver', u.id); return { ok: true }; }); });
  add('GET', '/api/driver/me', req => { const u = auth(req); role(u, 'driver'); const d = q('select vehicle_type,car,plate,is_woman,docs_status,suspended,vehicle_locked from drivers where user_id=?', u.id);
    const cr = q("select id,vehicle_type,car,plate,created_at from driver_change_requests where user_id=? and status='pending'", u.id), lr = q("select reason,decided_at from driver_change_requests where user_id=? and status='rejected' and id=(select max(id) from driver_change_requests where user_id=?)", u.id, u.id);
    if (d) { d.approval_required = !!d.vehicle_locked; delete d.vehicle_locked; }
    return { change_request: cr || null, last_rejection: lr || null, user: { name: u.name, phone: u.phone }, profile: d || null, docs: all('select id,kind,status,reason,expires_on,created_at from driver_docs where user_id=? order by id', u.id), required: REQ_DOCS,
      can_go_online: !!d && !d.suspended && (!requireApproval || d.docs_status === 'approved') }; });
  add('POST', '/api/driver/docs', (req, b) => { const u = auth(req); role(u, 'driver'); if (!q('select 1 from drivers where user_id=?', u.id)) throw bad('profile first'); limit('doc:' + u.id, 30, 3600e3);
    if (!REQ_DOCS.includes(b.kind)) throw bad('kind invalid'); if (typeof b.data !== 'string' || b.data.length > 2.2e6) throw bad('file too large');
    const buf = Buffer.from(b.data, 'base64'); if (buf.length < 200 || buf.length > 1.6e6) throw bad('file size invalid'); const mime = sniff(buf); if (!mime) throw bad('file type invalid');
    if (b.expires_on != null && !/^\d{4}-\d{2}-\d{2}$/.test(b.expires_on)) throw bad('expires_on invalid');
    const name = crypto.randomBytes(16).toString('hex') + EXT[mime]; fs.writeFileSync(path.join(upDir, name), buf, { mode: 0o600 });
    all('select id,file from driver_docs where user_id=? and kind=?', u.id, b.kind).forEach(o => { try { fs.unlinkSync(path.join(upDir, o.file)); } catch {} run('delete from driver_docs where id=?', o.id); });
    const i = run('insert into driver_docs(user_id,kind,mime,file,size,expires_on) values(?,?,?,?,?,?)', u.id, b.kind, mime, name, buf.length, b.expires_on || null); recalc(u.id); return { id: Number(i.lastInsertRowid) }; });
  add('GET', '/api/driver/docs/(\\d+)/file', (req, b, ctx, m) => { const u = auth(req); const d = q('select * from driver_docs where id=? and user_id=?', +m[1], u.id); if (!d) throw nf(); return fileOut(d); });
  add('POST', '/api/driver/online', (req, b) => { const u = auth(req); role(u, 'driver'); if (!q('select 1 from drivers where user_id=?', u.id)) throw bad('profile first');
    const on = b.online ? 1 : 0; if (on) { { const d0 = q('select * from drivers where user_id=?', u.id); if (d0.suspended) throw deny(); if (requireApproval && d0.docs_status !== 'approved') throw new HttpError(403, 'documents not approved'); } geo({ ...b, label: 'x' }, 'location'); run('update drivers set online=1,lat=?,lng=? where user_id=?', b.lat, b.lng, u.id); } else run('update drivers set online=0 where user_id=?', u.id); return { online: !!on }; });
  add('GET', '/api/driver/offers', req => { const u = auth(req); role(u, 'driver'); expireOffers();
    return { server_now: now(), offers: all('select id,request_id,price,status,expires_at from offers where driver_id=? order by id desc limit 50', u.id) }; });
  const km = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r * Math.cos((a + c) / 2 * r); return R * Math.hypot(x, y); };
  add('GET', '/api/driver/requests', req => { const u = auth(req); role(u, 'driver'); const d = q('select * from drivers where user_id=? and online=1', u.id); if (!d) return { requests: [] };
    const rows = all("select r.*, (select 1 from offers o where o.request_id=r.id and o.driver_id=?) mine from requests r where status='open' and expires_at>? and (women_only=0 or ?=1) and (kind='delivery' or vehicle_type=?)", u.id, now(), d.is_woman, d.vehicle_type);
    return { requests: rows.filter(r => km(d.lat, d.lng, r.p_lat, r.p_lng) <= 8).map(r => ({ id: r.id, price: r.price, p_label: r.p_label, d_label: r.d_label, note: r.note, kind: r.kind, item_type: r.item_type, item_note: r.item_note, dist_km: +km(d.lat, d.lng, r.p_lat, r.p_lng).toFixed(1), already_offered: !!r.mine })) }; });

  add('POST', '/api/fare/quote', (req, b) => { const u = auth(req); role(u, 'rider');
    const p = geo(b.pickup, 'pickup'), d = geo(b.dropoff, 'dropoff');
    const vehicle = b.vehicle_type === 'moto' ? 'moto' : 'car';
    const distanceKm = fareDistanceKm(p, d);
    return quoteFare({ distanceKm, vehicle });
  });
  /* ---- requests ---- */
  const ownReq = (u, id) => { const r = q('select * from requests where id=?', id); if (!r || r.rider_id !== u.id) throw nf(); return r; };
  add('POST', '/api/requests', (req, b) => { const u = auth(req); role(u, 'rider'); limit('mkreq:' + u.id, 10, 10 * 60e3);
    const p = geo(b.pickup, 'pickup'), d = geo(b.dropoff, 'dropoff'); const price = int(b.price, 50, 100000, 'price');
    const vehicleForQuote = b.vehicle_type === 'moto' ? 'moto' : 'car'; const fareQuote = quoteFare({ distanceKm: fareDistanceKm(p, d), vehicle: vehicleForQuote });
    const kind = b.kind === 'delivery' ? 'delivery' : 'ride';
    if (kind === 'ride' && price < MIN_FARE) throw bad('price below minimum fare');
    if (b.vehicle_type !== undefined && !['car', 'moto'].includes(b.vehicle_type)) throw bad('vehicle_type invalid');
    const vehicleType = kind === 'ride' ? (b.vehicle_type ?? 'car') : 'car';
    if (q("select 1 from requests where rider_id=? and status='open' and expires_at>?", u.id, now())) throw new HttpError(409, 'open request exists');
    let item_type = null, item_note = null, rname = null, rphone = null;
    if (kind === 'delivery') { if (!['food', 'parcel'].includes(b.item_type)) throw bad('item_type invalid'); item_type = b.item_type; item_note = str(b.item_note, 200, 'item_note');
      rname = str(b.recipient_name, 60, 'recipient_name', false) || u.name; rphone = b.recipient_phone ? normPhone(b.recipient_phone) : u.phone; if (!rphone) throw bad('recipient_phone invalid'); }
    const info = run('insert into requests(rider_id,p_lat,p_lng,p_label,d_lat,d_lng,d_label,price,note,women_only,expires_at,kind,item_type,item_note,recipient_name,recipient_phone,vehicle_type) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', u.id, p.lat, p.lng, p.label, d.lat, d.lng, d.label, price, str(b.note, 200, 'note', false), b.women_only ? 1 : 0, now() + 5 * 60e3, kind, item_type, item_note, rname, rphone, vehicleType);
    return { id: Number(info.lastInsertRowid), fare_quote: fareQuote }; });
  add('GET', '/api/requests/(\\d+)/offers', (req, b, ctx, m) => { const u = auth(req); const r = ownReq(u, +m[1]);
    expireRequests(); expireOffers(); const current = ownReq(u, r.id); if (current.status !== 'open') return { server_now: now(), offer_ttl_ms: OFFER_TTL_MS, offers: [] };
    return { server_now: now(), offer_ttl_ms: OFFER_TTL_MS, offers: all("select id,driver_id,price,eta_min,expires_at from offers where request_id=? and status='pending' and expires_at>?", r.id, now()).map(o => ({ ...o, driver: publicDriver(o.driver_id) })) }; });
  add('POST', '/api/requests/(\\d+)/cancel', (req, b, ctx, m) => { const u = auth(req); const id = +m[1];
    const changed = tx(() => { const r = ownReq(u, id); if (r.status !== 'open' || r.expires_at <= now()) throw new HttpError(409, 'not open');
      const result = run("update requests set status='cancelled' where id=? and rider_id=? and status='open' and expires_at>?", id, u.id, now());
      if (!result.changes) throw new HttpError(409, 'not open');
      run("update offers set status='declined' where request_id=? and status='pending'", id); return true; });
    return { ok: changed }; });
  add('POST', '/api/requests/(\\d+)/offers', (req, b, ctx, m) => { const u = auth(req); role(u, 'driver');
    const d = q('select * from drivers where user_id=? and online=1', u.id); if (!d) throw deny();
    const r = q("select * from requests where id=? and status='open' and expires_at>?", +m[1], now()); if (!r) throw nf();
    if (r.women_only && !d.is_woman) throw deny(); if (r.kind !== 'delivery' && r.vehicle_type !== d.vehicle_type) throw deny(); if (km(d.lat, d.lng, r.p_lat, r.p_lng) > 8) throw deny();
    const price = int(b.price, 50, 100000, 'price'); if (price > Math.round(r.price * 1.5)) throw bad('price too far above rider offer');
    const eta = int(b.eta_min, 0, 120, 'eta_min');
    try { const created = tx(() => { const current = q("select * from requests where id=? and status='open' and expires_at>?", r.id, now()); if (!current) throw new HttpError(409, 'request unavailable');
        const i = run('insert into offers(request_id,driver_id,price,eta_min,expires_at) values(?,?,?,?,?)', current.id, u.id, price, eta, now() + OFFER_TTL_MS);
        return { id: Number(i.lastInsertRowid), expires_at: now() + OFFER_TTL_MS, rider_id: current.rider_id }; });
      notify(created.rider_id, 'new_offer', r.id, String(price)); return { id: created.id, expires_at: created.expires_at }; }
    catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'already offered'); throw e; } });
  add('POST', '/api/offers/(\\d+)/accept', (req, b, ctx, m) => { const u = auth(req); role(u, 'rider'); expireOffers();
    const res = tx(() => { const o = q('select * from offers where id=?', +m[1]); if (!o) throw nf(); const r = ownReq(u, o.request_id);
      if (r.status === 'open' && r.expires_at <= now()) {
        run("update offers set status='expired' where request_id=? and status='pending'", r.id);
        run("update requests set status='expired' where id=? and status='open' and expires_at<=?", r.id, now());
        return { fail: 'request expired' };
      }
      if (o.status === 'expired' || (o.status === 'pending' && o.expires_at <= now())) { run("update offers set status='expired' where id=? and status='pending'", o.id); return { fail: 'offer expired' }; }
      if (r.status !== 'open' || o.status !== 'pending') throw new HttpError(409, 'not available');
      const d = q('select * from drivers where user_id=?', o.driver_id);
      if (!d || !d.online || d.suspended || (requireApproval && d.docs_status !== 'approved') || (r.kind !== 'delivery' && r.vehicle_type !== d.vehicle_type) || (r.women_only && !d.is_woman)) {
        run("update offers set status='declined' where id=?", o.id); return { fail: 'offer no longer valid' }; }
      try { const i = run('insert into rides(request_id,offer_id,rider_id,driver_id,locked_price) values(?,?,?,?,?)', r.id, o.id, u.id, o.driver_id, o.price);
        run("update offers set status=case when id=? then 'accepted' else 'declined' end where request_id=?", o.id, r.id); run("update requests set status='matched' where id=?", r.id); notify(o.driver_id, 'offer_accepted', Number(i.lastInsertRowid), String(o.price));
        return { ride_id: Number(i.lastInsertRowid), locked_price: o.price }; }
      catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'driver busy'); throw e; } });
    if (res.fail) throw new HttpError(409, res.fail); return res; });

  /* ---- rides ---- */
  const myRide = (u, id) => { const r = q('select * from rides where id=?', id); if (!r || (r.rider_id !== u.id && r.driver_id !== u.id)) throw nf(); return r; };
  const NEXT = { en_route: ['arrived', 'cancelled'], arrived: ['in_progress', 'cancelled'], in_progress: ['completed'] };
  add('POST', '/api/rides/(\\d+)/status', (req, b, ctx, m) => { const u = auth(req); const r = myRide(u, +m[1]); const to = b.status;
    if (r.status === to) return { status: r.status }; // idempotent retry
    if (to === 'cancelled') { if (!['en_route', 'arrived'].includes(r.status)) throw new HttpError(409, 'cannot cancel'); }
    else if (u.id !== r.driver_id) throw deny();
    if (!(NEXT[r.status] || []).includes(to)) throw new HttpError(409, 'bad transition');
    const changed = tx(() => run('update rides set status=? where id=? and status=?', to, r.id, r.status));
    if (!changed.changes) throw new HttpError(409, 'ride status changed; refresh and retry');
    notify(u.id === r.driver_id ? r.rider_id : r.driver_id, 'ride_status', r.id, to); return { status: to }; });
  add('POST', '/api/rides/(\\d+)/cash-collected', (req, b, ctx, m) => { const u = auth(req); const r = myRide(u, +m[1]);
    if (u.id !== r.driver_id) throw deny(); if (r.status !== 'completed') throw new HttpError(409, 'ride not completed');
    const payment = q('select payment_method,payment_status from rides where id=?', r.id);
    if (payment.payment_method !== 'cash') throw new HttpError(409, 'cash payment not applicable');
    if (payment.payment_status === 'paid') return { payment_status: 'paid' };
    run("update rides set payment_status='paid',paid_at=datetime('now') where id=? and payment_status='pending'", r.id);
    notify(r.rider_id, 'ride_status', r.id, 'cash_paid'); return { payment_status: 'paid' }; });
  add('GET', '/api/driver/cash-due', req => { const u = auth(req); role(u, 'driver'); return { rides: all("select id,locked_price,created_at from rides where driver_id=? and status='completed' and payment_method='cash' and payment_status='pending' order by id desc limit 20", u.id) }; });
  add('GET', '/api/notifications', req => { const u = auth(req); return { notifications: all('select id,kind,ref_id,detail,created_at,read_at from notifications where user_id=? order by id desc limit 50', u.id), unread: q('select count(*) c from notifications where user_id=? and read_at is null', u.id).c }; });
  add('POST', '/api/notifications/read', (req, b) => { const u = auth(req); if (b.id === undefined) run("update notifications set read_at=datetime('now') where user_id=? and read_at is null", u.id); else { const id = int(b.id, 1, 2 ** 53 - 1, 'id'); run("update notifications set read_at=datetime('now') where id=? and user_id=? and read_at is null", id, u.id); } return { ok: true }; });
  add('GET', '/api/driver/earnings', req => { const u = auth(req); role(u, 'driver'); const f = w => q(`select count(*) n, coalesce(sum(locked_price),0) total from rides where driver_id=? and status='completed' ${w}`, u.id);
    return { currency: 'DZD', gross: true, commission_applied: false, today: f("and date(created_at)=date('now')"), week: f("and date(created_at)>=date('now','-6 days')"), all: f('') }; });
  add('GET', '/api/rides', req => { const u = auth(req); return { rides: all("select id,status,locked_price,created_at,driver_id,rider_id,payment_method,payment_status,paid_at from rides where rider_id=? or driver_id=? order by id desc limit 50", u.id, u.id) }; });
  add('POST', '/api/rides/(\\d+)/rating', (req, b, ctx, m) => { const u = auth(req); const r = myRide(u, +m[1]); if (r.status !== 'completed') throw new HttpError(409, 'ride not completed');
    const stars = int(b.stars, 1, 5, 'stars'); const tags = Array.isArray(b.tags) ? b.tags.slice(0, 6).map(t => str(t, 40, 'tag')) : [];
    try { run('insert into ratings(ride_id,from_user,to_user,stars,tags) values(?,?,?,?,?)', r.id, u.id, u.id === r.rider_id ? r.driver_id : r.rider_id, stars, JSON.stringify(tags)); } catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'already rated'); throw e; }
    return { ok: true }; });
  add('POST', '/api/rides/(\\d+)/report', (req, b, ctx, m) => { const u = auth(req); const r = myRide(u, +m[1]); if (!['price_dispute', 'safety', 'other'].includes(b.kind)) throw bad('kind invalid');
    run('insert into reports(ride_id,reporter_id,kind,body) values(?,?,?,?)', r.id, u.id, b.kind, str(b.body, 1000, 'body', false)); return { ok: true }; });

  add('POST', '/api/me', (req, b) => { const u = auth(req);
    const name = str(b.name, 60, 'name', false), city = str(b.city, 60, 'city', false), lang = ['ar', 'fr', 'en'].includes(b.lang) ? b.lang : u.lang;
    run('update users set name=coalesce(?,name), city=coalesce(?,city), lang=? where id=?', name, city, lang, u.id); return { ok: true }; });
  const rideView = (r, u) => { const rq = q('select * from requests where id=?', r.request_id); const other = q('select name,phone from users where id=?', u.id === r.rider_id ? r.driver_id : r.rider_id);
    const v = { id: r.id, status: r.status, locked_price: r.locked_price, payment_method: r.payment_method || 'cash', payment_status: r.payment_status || 'pending', paid_at: r.paid_at || null, kind: rq.kind, item_type: rq.item_type, item_note: rq.item_note, p_label: rq.p_label, d_label: rq.d_label,
      role: r.driver_id === u.id ? 'driver' : 'rider', driver: publicDriver(r.driver_id) };
    if (['en_route', 'arrived', 'in_progress'].includes(r.status)) { // phones only between the two participants, only while the ride is live
      v.contact = { name: other.name, phone: other.phone };
      if (rq.kind === 'delivery' && u.id === r.driver_id) v.recipient = { name: rq.recipient_name, phone: rq.recipient_phone };
    }
    return v; };
  add('GET', '/api/rides/active', req => { const u = auth(req);
    const r = q("select * from rides where (rider_id=? or driver_id=?) and status in('en_route','arrived','in_progress') order by id desc limit 1", u.id, u.id);
    return { ride: r ? rideView(r, u) : null }; });
  add('GET', '/api/rides/(\\d+)', (req, b, ctx, m) => { const u = auth(req); return rideView(myRide(u, +m[1]), u); });
  add('POST', '/api/dev/role', (req, b) => { if (!dev) throw nf(); const u = auth(req); const ro = b.role === 'driver' ? 'driver' : 'rider';
    run('update users set role=? where id=?', ro, u.id);
    if (ro === 'driver') run('insert into drivers(user_id,car,plate,vehicle_locked) values(?,?,?,0) on conflict(user_id) do nothing', u.id, 'Renault Symbol', 'DEV-' + u.id);
    return { role: ro }; });
  /* ---- safety ---- */
  add('POST', '/api/safety/contacts', (req, b) => { const u = auth(req); const phone = normPhone(b.phone); if (!phone) throw bad('phone invalid');
    if (q('select count(*) c from safety_contacts where user_id=?', u.id).c >= 5) throw new HttpError(409, 'max 5 contacts');
    run('insert into safety_contacts(user_id,name,phone) values(?,?,?)', u.id, str(b.name, 60, 'name'), phone); return { ok: true }; });
  add('GET', '/api/safety/contacts', req => { const u = auth(req); return { contacts: all('select id,name,phone from safety_contacts where user_id=?', u.id) }; });

  add('POST', '/api/waitlist', (req, b, ctx) => { limit('wl:' + ctx.ip, 10, 10 * 60e3);
    const phone = normPhone(b.phone); if (!phone) throw bad('phone invalid'); if (!['rider', 'driver'].includes(b.role)) throw bad('role invalid');
    run('insert into waitlist(phone,role,city) values(?,?,?) on conflict(phone) do update set role=excluded.role', phone, b.role, str(b.city, 60, 'city', false)); return { ok: true }; });
  /* ---- admin (separate cookie `asid`, password login) ---- */
  const audit = (a, action, target, detail) => run('insert into audit(admin_id,action,target,detail) values(?,?,?,?)', a.id, action, target, detail || null);
  add('POST', '/api/admin/login', (req, b, ctx) => { limit('adm:' + ctx.ip, 10, 10 * 60e3); const phone = normPhone(b.phone); limit('admph:' + (phone || 'x'), 10, 10 * 60e3);
    const u = phone && q("select * from users where phone=? and role='admin'", phone); if (!u || !checkPw(b.password, u.password_hash)) throw new HttpError(401, 'invalid credentials');
    const tok = crypto.randomBytes(32).toString('hex'); run("insert into sessions(token_hash,user_id,expires_at,kind) values(?,?,?,'admin')", sha(tok), u.id, now() + 12 * 3600e3);
    ctx.headers['Set-Cookie'] = `asid=${tok}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${12 * 3600}${dev ? '' : '; Secure'}`; return { ok: true, name: u.name }; });
  add('POST', '/api/admin/logout', (req, b, ctx) => { const tok = cookieOf(req).asid; if (tok) run("delete from sessions where token_hash=? and kind='admin'", sha(tok)); ctx.headers['Set-Cookie'] = 'asid=; HttpOnly; Path=/; Max-Age=0'; return { ok: true }; });
  add('GET', '/api/admin/me', req => { const a = authAdmin(req); return { name: a.name, phone: a.phone }; });
  add('GET', '/api/admin/stats', req => { authAdmin(req); const c = sql => q(sql).c;
    return { riders: c("select count(*) c from users where role='rider'"), drivers: c('select count(*) c from drivers'), drivers_pending: c("select count(*) c from drivers d where docs_status='pending' and exists(select 1 from driver_docs x where x.user_id=d.user_id)"),
      drivers_online: c('select count(*) c from drivers where online=1'), rides_today: c("select count(*) c from rides where date(created_at)=date('now')"), rides_active: c("select count(*) c from rides where status in('en_route','arrived','in_progress')"),
      reports_open: c("select count(*) c from reports where status='open'"), waitlist: c('select count(*) c from waitlist'), pending_changes: c("select count(*) c from driver_change_requests where status='pending'"),
      drivers_approved: c("select count(*) c from drivers where docs_status='approved' and suspended=0"), drivers_suspended: c('select count(*) c from drivers where suspended=1'), users_total: c("select count(*) c from users where role in('rider','driver')"),
      rides_total: c('select count(*) c from rides'), rides_completed: c("select count(*) c from rides where status='completed'"), rides_cancelled: c("select count(*) c from rides where status='cancelled'"),
      fares_completed_dzd: c("select coalesce(sum(locked_price),0) c from rides where status='completed'"), // gross rider-driver fares; the platform takes no commission yet, so this is NOT revenue
      rides_by_day: all("select date(created_at) d,count(*) n from rides where created_at>=date('now','-13 days') group by 1 order by 1") }; });
  add('GET', '/api/admin/drivers', req => { authAdmin(req); const st = new URL(req.url, 'http://x').searchParams.get('status') || 'all';
    const rows = all(`select d.user_id id,u.name,u.phone,d.vehicle_type,d.car,d.plate,d.docs_status,d.suspended,d.online,
      (select count(*) from driver_change_requests c where c.user_id=d.user_id and c.status='pending') pending_change,(select count(*) from driver_docs x where x.user_id=d.user_id) docs,(select count(*) from rides r where r.driver_id=d.user_id and r.status='completed') rides
      from drivers d join users u on u.id=d.user_id order by (d.docs_status='pending') desc, d.user_id desc limit 200`);
    rows.forEach(r => { if (r.docs === 0 && r.docs_status === 'pending') r.docs_status = 'incomplete'; }); // registered but no documents sent yet
    return { drivers: st === 'all' ? rows : rows.filter(r => r.docs_status === st) }; });
  add('GET', '/api/admin/drivers/(\\d+)', (req, b, ctx, m) => { authAdmin(req); const d = q('select d.*,u.name,u.phone,u.created_at joined from drivers d join users u on u.id=d.user_id where d.user_id=?', +m[1]); if (!d) throw nf();
    d.pending_change = q("select id,vehicle_type,car,plate,created_at from driver_change_requests where user_id=? and status='pending'", d.user_id) || null; d.change_history = all('select id,request_id,action,actor_role,fields,created_at from driver_change_events where user_id=? order by id desc limit 50', d.user_id);
    return { driver: d, docs: all('select id,kind,status,reason,expires_on,size,created_at,reviewed_at from driver_docs where user_id=? order by id', d.user_id), required: REQ_DOCS, rating: q('select round(avg(stars),1) a,count(*) n from ratings where to_user=?', d.user_id) }; });
  add('GET', '/api/admin/docs/(\\d+)/file', (req, b, ctx, m) => { const a = authAdmin(req); const d = q('select * from driver_docs where id=?', +m[1]); if (!d) throw nf(); audit(a, 'view_doc', `doc:${d.id} user:${d.user_id}`); return fileOut(d); });
  add('POST', '/api/admin/docs/(\\d+)/review', (req, b, ctx, m) => { const a = authAdmin(req); const d = q('select * from driver_docs where id=?', +m[1]); if (!d) throw nf();
    if (!['approved', 'rejected'].includes(b.status)) throw bad('status invalid'); const reason = b.status === 'rejected' ? str(b.reason, 200, 'reason') : null;
    return tx(() => { run("update driver_docs set status=?,reason=?,reviewed_by=?,reviewed_at=datetime('now') where id=?", b.status, reason, a.id, d.id); lockVehicle(d.user_id); const st = recalc(d.user_id); audit(a, 'doc_' + b.status, `doc:${d.id} user:${d.user_id}`, reason); return { docs_status: st }; }); });
  add('POST', '/api/admin/drivers/(\\d+)/suspend', (req, b, ctx, m) => { const a = authAdmin(req); if (!q('select 1 from drivers where user_id=?', +m[1])) throw nf(); const s = b.suspended ? 1 : 0;
    run('update drivers set suspended=?, online=case when ?=1 then 0 else online end where user_id=?', s, s, +m[1]); audit(a, s ? 'suspend' : 'unsuspend', 'user:' + m[1], str(b.reason, 200, 'reason', false)); return { suspended: !!s }; });
  add('POST', '/api/admin/driver-changes/(\\d+)/decision', (req, b, ctx, m) => { const a = authAdmin(req);
    if (!['approved', 'rejected'].includes(b.decision)) throw bad('decision invalid'); const reason = b.decision === 'rejected' ? str(b.reason, 200, 'reason') : str(b.reason, 200, 'reason', false);
    return tx(() => { const c = q('select * from driver_change_requests where id=?', +m[1]); if (!c) throw nf(); if (c.status !== 'pending') throw new HttpError(409, 'not pending');
      const d = q('select * from drivers where user_id=?', c.user_id); if (!d) throw nf();
      const fields = [c.vehicle_type !== d.vehicle_type && 'type', c.car !== d.car && 'model', c.plate !== d.plate && 'plate'].filter(Boolean).join(',');
      if (b.decision === 'approved') {
        if (q("select 1 from rides where driver_id=? and status in('en_route','arrived','in_progress')", c.user_id)) throw new HttpError(409, 'driver has a live ride');
        if (plateTaken(c.plate, c.user_id)) throw new HttpError(409, 'plate already registered');
        run('update drivers set vehicle_type=?,car=?,plate=? where user_id=?', c.vehicle_type, c.car, c.plate, c.user_id);
        run("update offers set status='declined' where driver_id=? and status='pending' and request_id in(select id from requests where status='open')", c.user_id); }
      run("update driver_change_requests set status=?,reason=?,decided_by=?,decided_at=datetime('now') where id=?", b.decision, reason, a.id, c.id);
      ev(c.id, c.user_id, b.decision, 'admin', a.id, fields); audit(a, 'driver_change_' + b.decision, `user:${c.user_id} change:${c.id}`, `fields=${fields}` + (reason ? `; reason=${reason}` : ''));
      return { ok: true, status: b.decision }; }); });
  /* ---- vehicle-change review, passengers, audit log, activity, settings (all admin-only, read endpoints never expose secrets) ---- */
  const CH = "select c.id,c.user_id,c.status,c.vehicle_type,c.car,c.plate,c.prev_vehicle_type,c.prev_car,c.prev_plate,c.reason,c.created_at,c.decided_at,c.decided_by,u.name,u.phone,d.docs_status,d.suspended,d.vehicle_type live_type,d.car live_car,d.plate live_plate from driver_change_requests c join users u on u.id=c.user_id left join drivers d on d.user_id=c.user_id";
  const shapeChange = r => ({ id: r.id, status: r.status, created_at: r.created_at, decided_at: r.decided_at, reason: r.reason, driver: { id: r.user_id, name: r.name, phone: r.phone, docs_status: r.docs_status, suspended: !!r.suspended },
    current: { vehicle_type: r.prev_vehicle_type, car: r.prev_car, plate: r.prev_plate }, requested: { vehicle_type: r.vehicle_type, car: r.car, plate: r.plate }, live: r.live_plate == null ? null : { vehicle_type: r.live_type, car: r.live_car, plate: r.live_plate } });
  add('GET', '/api/admin/driver-changes', req => { authAdmin(req); const st = new URL(req.url, 'http://x').searchParams.get('status') || 'pending';
    if (!['pending', 'approved', 'rejected', 'cancelled', 'superseded', 'all'].includes(st)) throw bad('status invalid');
    return { changes: all(`${CH} ${st === 'all' ? '' : 'where c.status=?'} order by (c.status='pending') desc, c.id desc limit 200`, ...(st === 'all' ? [] : [st])).map(shapeChange) }; });
  add('GET', '/api/admin/driver-changes/(\\d+)', (req, b, ctx, m) => { authAdmin(req); const r = q(`${CH} where c.id=?`, +m[1]); if (!r) throw nf();
    return { change: shapeChange(r), history: all('select e.id,e.request_id,e.action,e.actor_role,e.fields,e.created_at,a.name actor_name from driver_change_events e left join users a on a.id=e.actor_id where e.user_id=? order by e.id desc limit 100', r.user_id) }; });
  const likeEsc = v => '%' + String(v).replace(/[\\%_]/g, '\\$&') + '%';
  add('GET', '/api/admin/passengers', req => { authAdmin(req); const qs = (new URL(req.url, 'http://x').searchParams.get('q') || '').trim().slice(0, 60);
    return { passengers: all(`select u.id,u.name,u.phone,u.created_at,(select count(*) from rides r where r.rider_id=u.id) rides,(select count(*) from rides r where r.rider_id=u.id and r.status='completed') completed,(select count(*) from rides r where r.rider_id=u.id and r.status='cancelled') cancelled,(select count(*) from reports p where p.reporter_id=u.id) reports from users u where u.role='rider' ${qs ? "and (u.name like ? escape '\\' or u.phone like ? escape '\\')" : ''} order by u.id desc limit 100`, ...(qs ? [likeEsc(qs), likeEsc(qs)] : [])) }; });
  add('GET', '/api/admin/passengers/(\\d+)', (req, b, ctx, m) => { const a = authAdmin(req); const u = q("select id,name,phone,created_at from users where id=? and role='rider'", +m[1]); if (!u) throw nf(); audit(a, 'view_passenger', `user:${u.id}`);
    return { passenger: u, rides: all("select r.id,r.status,r.locked_price,r.created_at,d.name driver_name from rides r left join users d on d.id=r.driver_id where r.rider_id=? order by r.id desc limit 50", u.id), reports: all('select id,ride_id,kind,status,created_at from reports where reporter_id=? order by id desc limit 50', u.id) }; });
  add('GET', '/api/admin/audit', req => { authAdmin(req); const sp = new URL(req.url, 'http://x').searchParams; const act = (sp.get('action') || '').slice(0, 40); const lim = Math.min(Math.max(parseInt(sp.get('limit') || '100', 10) || 100, 1), 500);
    return { entries: all(`select a.id,a.action,a.target,a.detail,a.created_at,u.name admin_name from audit a left join users u on u.id=a.admin_id ${act ? 'where a.action=?' : ''} order by a.id desc limit ${lim}`, ...(act ? [act] : [])) }; });
  add('GET', '/api/admin/activity', req => { authAdmin(req);
    const items = [...all('select id,action,target,created_at at from audit order by id desc limit 10').map(r => ({ type: 'audit', ref: r.action, target: r.target, at: r.at })), ...all('select id,status,created_at at from rides order by id desc limit 10').map(r => ({ type: 'ride', ref: r.id, status: r.status, at: r.at })),
      ...all('select id,request_id,action,actor_role,created_at at from driver_change_events order by id desc limit 10').map(r => ({ type: 'vehicle_change', ref: r.request_id, status: r.action, actor: r.actor_role, at: r.at }))];
    return { items: items.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, 15) }; });
  add('GET', '/api/admin/settings', req => { authAdmin(req); // read-only: only values the server really enforces; no secrets, no credentials
    return { offer_ttl_ms: OFFER_TTL_MS, counteroffer_max_ratio: 1.5, require_driver_approval: !!requireApproval, otp_mode: dev ? 'development' : (sendSms ? 'sms' : 'unavailable'), environment: dev ? 'development' : 'production' }; });
  add('GET', '/api/admin/rides', req => { authAdmin(req); const sp = new URL(req.url, 'http://x').searchParams; const st = sp.get('status') || null; const term = (sp.get('q') || '').slice(0, 40).replace(/[%_\\]/g, ''); const like = '%' + term + '%';
    return { rides: all(`select r.id,r.status,r.locked_price price,r.created_at,q.kind,q.item_type,q.p_label,q.d_label,ru.name rider_name,ru.phone rider_phone,du.name driver_name,du.phone driver_phone
      from rides r join requests q on q.id=r.request_id join users ru on ru.id=r.rider_id join users du on du.id=r.driver_id
      where (:st is null or r.status=:st) and (:like='%%' or ru.phone like :like or du.phone like :like or ru.name like :like or du.name like :like) order by r.id desc limit 100`, { st, like }) }; });
  add('GET', '/api/admin/rides/(\\d+)', (req, b, ctx, m) => { authAdmin(req); const r = q(`select r.*,q.kind,q.item_type,q.item_note,q.recipient_name,q.recipient_phone,q.p_label,q.d_label,q.price offered_price,q.note,
      ru.name rider_name,ru.phone rider_phone,du.name driver_name,du.phone driver_phone from rides r join requests q on q.id=r.request_id join users ru on ru.id=r.rider_id join users du on du.id=r.driver_id where r.id=?`, +m[1]); if (!r) throw nf();
    return { ride: r, ratings: all('select from_user,to_user,stars,tags from ratings where ride_id=?', r.id), reports: all('select id,kind,body,status,created_at from reports where ride_id=?', r.id) }; });
  add('GET', '/api/admin/reports', req => { authAdmin(req); return { reports: all(`select p.id,p.ride_id,p.kind,p.body,p.status,p.created_at,u.name reporter,u.phone reporter_phone from reports p join users u on u.id=p.reporter_id order by (p.status='open') desc, p.id desc limit 100`) }; });
  add('POST', '/api/admin/reports/(\\d+)', (req, b, ctx, m) => { const a = authAdmin(req); if (!q('select 1 from reports where id=?', +m[1])) throw nf(); if (!['open', 'reviewing', 'closed'].includes(b.status)) throw bad('status invalid');
    run('update reports set status=? where id=?', b.status, +m[1]); { const rp = q('select reporter_id,ride_id from reports where id=?', +m[1]); notify(rp.reporter_id, 'report_status', rp.ride_id, b.status); } audit(a, 'report_' + b.status, 'report:' + m[1]); return { ok: true }; });

  add('GET', '/api/config/maps', () => { const key = String(process.env.MAPS_BROWSER_API_KEY || '').trim(); return { enabled: !!key, browser_key: key || null, provider: key ? 'google' : null }; });
  add('GET', '/api/health', () => { db.prepare('select 1').get(); return { ok: true, db: 'ok' }; });

  const server = http.createServer((req, res) => {
    const ctx = { headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...(process.env.NODE_ENV === 'production' ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}) }, ip: clientIp(req) };
    const send = (code, obj) => { res.writeHead(code, ctx.headers); res.end(JSON.stringify(obj)); };
    const url = new URL(req.url, 'http://x'); let size = 0; const chunks = [];
    const PAGES = { '/': 'app/index.html', '/index.html': 'app/index.html', '/driver': 'app/driver.html', '/admin': 'app/admin.html', '/app': 'app/kherja.html', '/app/driver': 'app/kherja.html', /* Phase 2 preview of the one-app shell; '/' and '/driver' are unchanged until cutover is approved */ '/landing': 'launch/landing.html' };
    /* self-hosted UI fonts (Plus Jakarta Sans + Tajawal): fixed whitelist pattern, no directory traversal */
    if (req.method === 'GET' && /^\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname)) {
      const f = path.join(__dirname, '..', 'app', url.pathname); if (!fs.existsSync(f)) return send(404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': 'font/woff2', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable', ...(process.env.NODE_ENV === 'production' ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}) });
      return res.end(fs.readFileSync(f));
    }
    /* legacy single-role pages are not the product any more: outside dev mode send visitors to the one-app shell (no-store so the redirect is never cached) */
    const LEGACY = { '/': '/app', '/index.html': '/app', '/driver': '/app/driver' };
    if (redirectLegacy && (req.method === 'GET' || req.method === 'HEAD') && LEGACY[url.pathname]) { res.writeHead(302, { Location: LEGACY[url.pathname], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(process.env.NODE_ENV === 'production' ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}) }); return res.end(); }
    if (req.method === 'GET' && PAGES[url.pathname]) {
      const f = path.join(__dirname, '..', PAGES[url.pathname]); if (!fs.existsSync(f)) return send(404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", ...(process.env.NODE_ENV === 'production' ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}) });
      return res.end(fs.readFileSync(f));
    }
    if (req.method !== 'GET' && !/^application\/json/i.test(req.headers['content-type'] || '')) return send(415, { error: 'json required' });
    const maxBytes = url.pathname === '/api/driver/docs' ? 2.3e6 : 10240;
    req.on('data', c => { size += c.length; if (size > maxBytes) { send(413, { error: 'too large' }); req.destroy(); } else chunks.push(c); });
    req.on('end', async () => {
      if (res.writableEnded) return;
      try {
        // Same-origin guard for state-changing API requests. The API deliberately
        // accepts JSON only; this additionally rejects cross-site browser fetches
        // and mismatched Origin headers before any route can mutate state.
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && url.pathname.startsWith('/api/')) {
          const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
          if (fetchSite === 'cross-site') throw new HttpError(403, 'cross_site_request');
          const origin = req.headers.origin;
          if (origin) {
            let parsed;
            try { parsed = new URL(origin); } catch { throw new HttpError(403, 'origin_forbidden'); }
            const requestHost = String(req.headers.host || '').toLowerCase();
            if (!requestHost || parsed.host.toLowerCase() !== requestHost || !['http:', 'https:'].includes(parsed.protocol))
              throw new HttpError(403, 'origin_forbidden');
          }
        }
        let body = {}; if (chunks.length) { try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw bad('json invalid'); } if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('json invalid'); }
        for (const r of routes) { if (r.method !== req.method) continue; const m = url.pathname.match(r.re); if (!m) continue; const out = await r.fn(req, body, ctx, m);
          if (out && out.__file) { res.writeHead(200, { 'Content-Type': out.__file.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'" }); return res.end(out.__file.buf); }
          return send(200, out); }
        throw nf();
      } catch (e) { if (e instanceof HttpError) return send(e.code, { error: e.message }); console.error(e.message); send(500, { error: 'server error' }); }
    });
  });
  server.db = db;
  const originalClose = server.close.bind(server); let dbClosed = false;
  server.close = cb => originalClose(err => { if (!dbClosed) { dbClosed = true; try { db.close(); } catch {} } if (typeof cb === 'function') cb(err); });
  server.uploadDir = upDir; server.dbPath = dbPath;
  return server;
}
async function createTwilioSmsSender(env = process.env) {
  const sid = String(env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(env.TWILIO_AUTH_TOKEN || '').trim();
  const from = String(env.TWILIO_FROM || '').trim();
  if (!sid || !token || !from) return null;
  if (!/^AC[0-9a-f]{32}$/i.test(sid)) throw new Error('invalid TWILIO_ACCOUNT_SID');
  if (from.length > 20 || !/^[A-Za-z0-9+ -]+$/.test(from)) throw new Error('invalid TWILIO_FROM');
  return async (phone, code) => {
    const body = new URLSearchParams({ To: phone, From: from, Body: `KHERJA: your verification code is ${code}. It expires in 5 minutes. Do not share it.` });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Twilio SMS request failed (${response.status})`);
    const result = await response.json();
    if (!result || !result.sid || !['accepted', 'queued', 'sending', 'sent', 'delivered'].includes(result.status))
      throw new Error('Twilio did not accept SMS');
    return { sid: result.sid, status: result.status };
  };
}

module.exports = { createApp, resolveConfig, resolveClientIp, createTwilioSmsSender };
if (require.main === module) {
  let cfg, srv;
  (async () => {
  try {
    cfg = resolveConfig();
    const runtime = require('./runtime');
    runtime.assertSupportedRuntime({ secure: cfg.prod });
    runtime.runSqliteCanaries();
    const smsConfigured = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'].some(k => Boolean(process.env[k]));
    if (smsConfigured && !['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'].every(k => Boolean(process.env[k]))) throw new Error('Twilio SMS configuration is incomplete');
    const sendSms = await createTwilioSmsSender(process.env);
    srv = createApp({ dbPath: cfg.dbPath, uploadDir: cfg.uploadDir, busyTimeout: cfg.busyTimeout, trustedProxyIps: cfg.trustedProxyIps, dev: cfg.dev, devAdmin: cfg.devAdmin, admin: cfg.admin, sendSms });
  }
  catch (e) { console.error('kherja: ' + e.message); process.exit(1); }
  if (!cfg.dev && !process.env.TWILIO_ACCOUNT_SID) console.warn('kherja: SMS is not configured; /api/auth/otp answers 503 sms_unavailable until Twilio credentials and sender approval are supplied');
  let shuttingDown = false;
  const shutdown = signal => { if (shuttingDown) return; shuttingDown = true; console.log(`kherja: received ${signal}; shutting down`);
    const force = setTimeout(() => { console.error('kherja: graceful shutdown timed out'); process.exit(1); }, 10000); force.unref();
    srv.close(err => { clearTimeout(force); if (err) { console.error('kherja: shutdown error: ' + err.message); process.exitCode = 1; } });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM')); process.once('SIGINT', () => shutdown('SIGINT'));
  srv.on('error', e => { console.error('kherja: listen failed: ' + e.message); process.exitCode = 1; });
  srv.listen(cfg.port, cfg.host, () => console.log(`kherja api on ${cfg.host}:${srv.address().port} (${cfg.dev ? 'DEV MODE' : 'secure mode'})`));
  })().catch(e => { console.error('kherja: ' + e.message); process.exit(1); });
}
