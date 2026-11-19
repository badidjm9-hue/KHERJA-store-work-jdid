// M0 verification gaps: strict lock whitelist, migration interruption/recovery, pre-M0 restore, audit-failure rollback,
// live-ride decision, and database-level plate uniqueness incl. true multi-process races.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { createApp } = require('./server');
const mig = f => fs.readFileSync(path.join(__dirname, 'migrations', f), 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kv-'));
const P = { lat: 36.75, lng: 3.05, label: 'A' }, D = { lat: 36.69, lng: 3.21, label: 'B' };
let n = 0;
const call = base => { const jar = {}; const c = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') }, body: b ? JSON.stringify(b) : undefined });
  for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); } return { s: r.status, j: await r.json() }; };
  c.login = async (role) => { const phone = '0555' + String(300000 + n++); await c('POST', '/api/auth/otp', { phone }); const r = await c('POST', '/api/auth/verify', { phone, code: '123456', role, name: 'u' }); assert.equal(r.s, 200); return r; }; return c; };
async function boot(opts = {}) { const s = createApp({ dev: true, devAdmin: true, ...opts }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port; return { s, base, client: () => call(base), close: () => new Promise(r => s.close(r)) }; }
async function drv(b, plate, locked = true) { const d = b.client(); await d.login('driver'); assert.equal((await d('POST', '/api/driver/profile', { car: 'Symbol', plate })).s, 200);
  await d('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 }); if (locked) b.s.db.prepare('update drivers set vehicle_locked=1 where plate=?').run(plate); return d; }
const adm = async b => { const a = b.client(); assert.equal((await a('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' })).s, 200); return a; };
const quiet = async fn => { const o = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = o; } };

/* ---- 1. strict whitelist of vehicle_locked writers ---- */
test('vehicle_locked: strict whitelist of every occurrence in backend code; no dynamic column SQL', () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && !f.endsWith('.test.js')).concat(fs.readdirSync(path.join(__dirname, '..', 'scripts')).map(f => '../scripts/' + f));
  const hits = []; for (const f of files) fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').forEach((l, i) => { if (/vehicle_locked|locked\b.*drivers|drivers.*\blocked\b/i.test(l) && /vehicle_locked/.test(l)) hits.push({ f, line: i + 1, l }); });
  assert.ok(hits.every(h => h.f === 'server.js'), 'only server.js may name vehicle_locked');
  const WL = [ // [name, exact-fragment regex, expected count]
    ['migration: has() probe', /^\s*if \(!has\('drivers', 'vehicle_locked'\)\) \{$/, 1],
    ['migration: add column, default 1 (fail closed)', /db\.exec\('alter table drivers add column vehicle_locked integer not null default 1'\);$/, 1],
    ['migration: one-time unlock of pristine rows', /^\s*db\.exec\(`update drivers set vehicle_locked=0 where docs_status='pending' and suspended=0 and online=0 and lat is null and lng is null$/, 1],
    ['trigger forbidding 1->0', /^\s*create trigger if not exists vehicle_lock_irreversible before update of vehicle_locked on drivers when old\.vehicle_locked=1 and new\.vehicle_locked<>1 begin select raise\(abort,'vehicle_locked is irreversible'\); end;$/, 1],
    ['lockVehicle(): the only runtime writer', /^\s*const lockVehicle = uid => run\('update drivers set vehicle_locked=1 where user_id=\?', uid\);$/, 1],
    ['onboarding insert (explicit 0)', /run\('insert into drivers\(user_id,car,plate,is_woman,vehicle_type,vehicle_locked\) values\(\?,\?,\?,\?,\?,0\)', u\.id, car, plate, w \?\? 0, b\.vehicle_type \?\? 'car'\)/, 1],
    ['read: branch on lock', /^\s*if \(!d\.vehicle_locked\) \{ if \(plateTaken\(plate, u\.id\)\)/, 1],
    ['read: driver/me select', /select vehicle_type,car,plate,is_woman,docs_status,suspended,vehicle_locked from drivers where user_id=\?/, 1],
    ['read: driver/me projection', /^\s*if \(d\) \{ d\.approval_required = !!d\.vehicle_locked; delete d\.vehicle_locked; \}$/, 1],
    ['dev/role placeholder insert (explicit 0)', /run\('insert into drivers\(user_id,car,plate,vehicle_locked\) values\(\?,\?,\?,0\) on conflict\(user_id\) do nothing'/, 1]];
  const unmatched = [], count = new Map();
  for (const h of hits) { const w = WL.find(x => x[1].test(h.l)); if (!w) unmatched.push(h); else count.set(w[0], (count.get(w[0]) || 0) + 1); }
  assert.deepEqual(unmatched.map(h => `${h.f}:${h.line} ${h.l.trim().slice(0, 100)}`), [], 'unexpected vehicle_locked reference');
  for (const [name, , c] of WL) assert.equal(count.get(name) || 0, c, 'whitelist entry count: ' + name);
  const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert.equal([...src.matchAll(/vehicle_locked/g)].length, hits.map(h => (h.l.match(/vehicle_locked/g) || []).length).reduce((a, b) => a + b, 0), 'no occurrence hidden outside a scanned line');
  // every runtime SQL that writes drivers, and why it is safe:
  const writers = [...src.matchAll(/(?:run|db\.exec)\(\s*[`'"](update drivers set [^`'"]*|insert into drivers\([^`'"]*)/g)].map(m => m[1].replace(/\s+/g, ' ').trim());
  for (const w of writers) assert.ok(!/\$\{|' *\+/.test(w), 'no interpolated column list: ' + w);
  assert.ok(!/update drivers set \$\{|update drivers set ' *\+|`update drivers set[^`]*\$\{/.test(src), 'no dynamic update drivers');
  assert.ok(!/\beval\(|new Function\(/.test(src)); assert.ok(!/Object\.(keys|entries|assign)\(\s*b\s*\)|for \(const \w+ in b\)/.test(src), 'request body is never iterated into SQL');
});

/* ---- 2. migration interruption / recovery ---- */
function legacyDb(file, withData = true) { const db = new DatabaseSync(file); db.exec(mig('001_init.sql'));
  { const have = db.prepare('pragma table_info(requests)').all().map(c => c.name); for (const [c, d] of [['kind', "text not null default 'ride'"], ['item_type', 'text'], ['item_note', 'text'], ['recipient_name', 'text'], ['recipient_phone', 'text'], ['vehicle_type', "text not null default 'car' check(vehicle_type in('car','moto'))"]]) if (!have.includes(c)) db.exec(`alter table requests add column ${c} ${d}`); }
  db.exec(mig('002_admin.sql')); for (const [t, c, d] of [['drivers', 'vehicle_type', "text not null default 'car'"], ['drivers', 'suspended', 'integer not null default 0'], ['users', 'password_hash', 'text'], ['sessions', 'kind', "text not null default 'user' check(kind in('user','admin'))"]]) db.exec(`alter table ${t} add column ${c} ${d}`);
  if (withData) db.exec(`insert into users(id,phone,name,role) values(1,'+213555000001','Rider','rider'),(2,'+213555000002','Appr','driver'),(3,'+213555000003','Pristine','driver'),(4,'+213555000004','Susp','driver'),(5,'+213555000005','Moto','driver'),(9,'+213555000009','Adm','admin');
    insert into drivers(user_id,car,plate,docs_status,vehicle_type,is_woman) values(2,'Symbol','04721-116-16','approved','car',0),(3,'Clio','00001-100-16','pending','car',0),(4,'Golf','00002-100-16','approved','car',1),(5,'Vespa','00003-100-16','approved','moto',0);
    update drivers set suspended=1 where user_id=4; update drivers set online=1,lat=36.7,lng=3.0 where user_id=2;
    insert into driver_docs(user_id,kind,mime,file,size,status) values(2,'license','image/jpeg','f1',300,'approved'),(4,'license','image/jpeg','f2',300,'approved');
    insert into requests(id,rider_id,p_lat,p_lng,p_label,d_lat,d_lng,d_label,price,expires_at,status) values(1,1,36.7,3.0,'a',36.6,3.1,'b',500,9e15,'matched'),(2,1,36.7,3.0,'a',36.6,3.1,'b',400,9e15,'open');
    insert into offers(id,request_id,driver_id,price,eta_min,status) values(1,1,2,500,3,'accepted'),(2,2,2,420,4,'pending');
    insert into rides(id,request_id,offer_id,rider_id,driver_id,locked_price,status) values(1,1,1,1,2,500,'completed');
    insert into audit(admin_id,action,target,detail) values(9,'doc_approved','doc:1 user:2',null),(9,'suspend','user:4','fraud');`); db.close(); }
const SNAP = { users: '*', drivers: 'user_id,car,plate,online,lat,lng,is_woman,docs_status,vehicle_type,suspended', requests: '*', rides: 'id,request_id,offer_id,rider_id,driver_id,status,locked_price,created_at', audit: '*', driver_docs: '*', ratings: '*', offers: 'id,request_id,driver_id,price,eta_min,created_at' };
const snap = f => { const db = new DatabaseSync(f, { readOnly: true }); try { return Object.fromEntries(Object.entries(SNAP).map(([t, c]) => [t, db.prepare(`select ${c} from ${t} order by 1,2`).all().map(r => ({ ...r }))])); } finally { db.close(); } };
const objects = f => { const db = new DatabaseSync(f, { readOnly: true }); try { return db.prepare("select type,name from sqlite_master where name like 'driver_change%' or name like 'dce_%' or name like 'dcr_%' or name like 'drv_%' or name like 'one_pending%' or name like 'vehicle_lock%' or name like 'offer_expiry%' or name='idx_off_exp' or name='idx_dce_user' order by name").all().map(r => r.type + ':' + r.name); } finally { db.close(); } };
const locks = f => { const db = new DatabaseSync(f, { readOnly: true }); try { return Object.fromEntries(db.prepare('select user_id u,vehicle_locked l from drivers').all().map(r => [r.u, r.l])); } finally { db.close(); } };
const hasCol = (f, t, c) => { const db = new DatabaseSync(f, { readOnly: true }); try { return db.prepare(`pragma table_info(${t})`).all().some(x => x.name === c); } finally { db.close(); } };
const integrity = f => { const db = new DatabaseSync(f, { readOnly: true }); try { return [db.prepare('pragma integrity_check').get().integrity_check, db.prepare('pragma foreign_key_check').all().length]; } finally { db.close(); } };

test('interrupted migration: failure inside the transaction rolls back completely and the next boot completes it', async () => {
  const f = path.join(tmp(), 'l.db'); legacyDb(f); const before = snap(f);
  const x = new DatabaseSync(f); x.exec("create trigger boom before update on drivers begin select raise(abort,'simulated crash'); end;"); x.close();
  assert.throws(() => createApp({ dev: true, dbPath: f }), /simulated crash/);
  assert.equal(hasCol(f, 'drivers', 'vehicle_locked'), false, 'column add rolled back with the failed unlock');
  assert.deepEqual(snap(f), before, 'no data changed'); assert.deepEqual(objects(f), [], 'no half-created M0 objects'); assert.deepEqual(integrity(f), ['ok', 0]);
  const y = new DatabaseSync(f); y.exec('drop trigger boom'); y.close();
  const s = createApp({ dev: true, dbPath: f }); await new Promise(r => s.close(r));
  assert.deepEqual(locks(f), { 2: 1, 3: 0, 4: 1, 5: 1 }, 'only the pristine driver (3) is unlocked'); assert.deepEqual(snap(f).drivers, before.drivers);
  assert.equal(objects(f).length >= 12, true); assert.deepEqual(integrity(f), ['ok', 0]); });
test('interrupted DDL after the lock transaction: every missing object is recreated, locks and data untouched', async () => {
  const f = path.join(tmp(), 'l.db'); legacyDb(f); createApp({ dev: true, dbPath: f }).close(); const full = objects(f), lk = locks(f), before = snap(f);
  const x = new DatabaseSync(f); // simulate a crash between the autocommit statements of the DDL batch
  x.exec('drop trigger vehicle_lock_irreversible; drop trigger dce_no_update; drop trigger dce_no_delete; drop trigger dcr_plate_taken; drop trigger drv_plate_pending_ins; drop trigger drv_plate_pending_upd; drop trigger offer_expiry_immutable; drop index one_pending_plate_norm; drop table driver_change_events;'); x.close();
  assert.ok(objects(f).length < full.length); const s = createApp({ dev: true, dbPath: f }); await new Promise(r => s.close(r));
  assert.deepEqual(objects(f), full); assert.deepEqual(locks(f), lk); assert.deepEqual(snap(f), before); assert.deepEqual(integrity(f), ['ok', 0]);
  const s2 = createApp({ dev: true, dbPath: f }); assert.throws(() => s2.db.prepare('update drivers set vehicle_locked=0 where user_id=2').run(), /irreversible/); await new Promise(r => s2.close(r)); });

/* ---- 3. pre-M0 backup restore, then M0 migration ---- */
test('restore a pre-M0 backup (real backup/restore scripts), then migrate: legacy drivers, vehicles, requests and audit stay consistent', async () => {
  const root = tmp(), live = path.join(root, 'live'); fs.mkdirSync(live); const f = path.join(live, 'kherja.db'); legacyDb(f); const before = snap(f);
  const env = { ...process.env, DB_PATH: f, UPLOAD_DIR: path.join(live, 'uploads') }; fs.mkdirSync(env.UPLOAD_DIR);
  const bk = path.join(root, 'bk'), rs = path.join(root, 'restored'); execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'backup.js'), bk], { env }); execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'restore.js'), bk, rs], { env });
  const rf = path.join(rs, 'kherja.db'); assert.equal(hasCol(rf, 'drivers', 'vehicle_locked'), false, 'backup really is pre-M0'); assert.deepEqual(snap(rf), before);
  const s = createApp({ dev: true, dbPath: rf }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port; const after = snap(rf);
  assert.deepEqual(after.drivers, before.drivers, 'active vehicles identical'); for (const t of ['users', 'requests', 'rides', 'audit', 'driver_docs']) assert.deepEqual(after[t], before[t], t + ' identical');
  assert.deepEqual(after.offers, before.offers, 'offer rows identical apart from status'); assert.deepEqual(Object.fromEntries(s.db.prepare('select id,status,expires_at from offers').all().map(o => [o.id, o.status + ':' + o.expires_at])), { 1: 'accepted:0', 2: 'expired:0' }, 'legacy in-flight offer expired (fail closed), accepted offer untouched');
  assert.deepEqual(locks(rf), { 2: 1, 3: 0, 4: 1, 5: 1 }); assert.throws(() => s.db.prepare('update rides set locked_price=1').run(), /immutable/); assert.deepEqual(integrity(rf), ['ok', 0]);
  const d = call(base); await d.login('driver'); // a brand-new driver can still onboard against the legacy plates
  assert.equal((await d('POST', '/api/driver/profile', { car: 'x', plate: '٠٤٧٢١ 116 16' })).s, 409, 'legacy plate protected incl. normalization');
  await new Promise(r => s.close(r)); });

/* ---- 4. audit-failure rollback ---- */
async function pendingSetup() { const f = path.join(tmp(), 'k.db'); const b = await boot({ dbPath: f }); const d = await drv(b, 'AF-1'), a = await adm(b);
  const r = b.client(); await r.login('rider'); const rq = await r('POST', '/api/requests', { pickup: P, dropoff: D, price: 450 }); const of = await d('POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 });
  const ch = await d('POST', '/api/driver/profile', { car: 'NewCar', plate: 'AF-2', vehicle_type: 'moto' }); assert.equal(ch.j.change, 'pending');
  const x = new DatabaseSync(f); const state = () => ({ drv: { ...b.s.db.prepare('select car,plate,vehicle_type,vehicle_locked from drivers where plate in(?,?)').get('AF-1', 'AF-2') }, reqs: b.s.db.prepare('select id,status,reason,decided_by from driver_change_requests order by id').all().map(r => ({ ...r })),
    ev: b.s.db.prepare('select count(*) c from driver_change_events').get().c, aud: b.s.db.prepare('select count(*) c from audit').get().c, off: b.s.db.prepare('select status from offers where id=?').get(of.j.id).status });
  return { b, d, a, x, state, id: ch.j.request_id, trig: (name, table, when) => x.exec(`create trigger ${name} before insert on ${table} ${when ? 'when ' + when : ''} begin select raise(abort,'forced failure'); end;`) }; }
for (const [label, table, when, decision] of [['audit insert fails on approve', 'audit', "new.action='driver_change_approved'", 'approved'], ['event insert fails on approve', 'driver_change_events', "new.action='approved'", 'approved'],
  ['audit insert fails on reject', 'audit', "new.action='driver_change_rejected'", 'rejected'], ['event insert fails on reject', 'driver_change_events', "new.action='rejected'", 'rejected']])
  test('audit-failure rollback: ' + label + ' → 500 and nothing changes', async () => { const t = await pendingSetup(); const before = t.state(); t.trig('tf', table, when);
    const r = await quiet(() => t.a('POST', `/api/admin/driver-changes/${t.id}/decision`, { decision, reason: 'because' })); assert.equal(r.s, 500); assert.deepEqual(t.state(), before, 'complete rollback'); assert.equal(before.reqs[0].status, 'pending'); assert.equal(before.off, 'pending');
    t.x.exec('drop trigger tf'); assert.equal((await t.a('POST', `/api/admin/driver-changes/${t.id}/decision`, { decision, reason: 'because' })).s, 200, 'control: succeeds once the fault is removed'); assert.equal(t.state().ev, before.ev + 1); assert.equal(t.state().aud, before.aud + 1); t.x.close(); await t.b.close(); });
test('audit-failure rollback: cancel and new-request events', async () => {
  const t = await pendingSetup(); const before = t.state(); t.trig('tc', 'driver_change_events', "new.action='cancelled'");
  assert.equal((await quiet(() => t.d('POST', '/api/driver/vehicle-change/cancel', { request_id: t.id }))).s, 500); assert.deepEqual(t.state(), before, 'cancel rolled back, still pending'); t.x.exec('drop trigger tc');
  t.trig('tr', 'driver_change_events', "new.action='requested'"); const r = await quiet(() => t.d('POST', '/api/driver/profile', { car: 'Other', plate: 'AF-3', vehicle_type: 'car' })); assert.equal(r.s, 500);
  assert.deepEqual(t.state(), before, 'replacement failed: old request is still pending, not superseded, no new row'); t.x.exec('drop trigger tr'); assert.equal((await t.d('POST', '/api/driver/vehicle-change/cancel', { request_id: t.id })).s, 200); t.x.close(); await t.b.close(); });

/* ---- 5. live ride ---- */
test('admin approve with a live ride: exact 409, nothing partially modified; approve works after the ride completes', async () => {
  const f = path.join(tmp(), 'k.db'); const b = await boot({ dbPath: f }); const d = await drv(b, 'LR-1'), a = await adm(b); const r = b.client(); await r.login('rider');
  const rq = await r('POST', '/api/requests', { pickup: P, dropoff: D, price: 450 }); const of = await d('POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 }); const acc = await r('POST', `/api/offers/${of.j.id}/accept`); assert.equal(acc.s, 200);
  const ch = await d('POST', '/api/driver/profile', { car: 'Live', plate: 'LR-2', vehicle_type: 'moto' }); assert.equal(ch.j.change, 'pending');
  const st = () => JSON.stringify([b.s.db.prepare('select * from drivers').all(), b.s.db.prepare('select * from driver_change_requests').all(), b.s.db.prepare('select * from offers').all(), b.s.db.prepare('select * from rides').all(), b.s.db.prepare('select count(*) c from driver_change_events').get(), b.s.db.prepare('select count(*) c from audit').get()]); const before = st();
  const res = await a('POST', `/api/admin/driver-changes/${ch.j.request_id}/decision`, { decision: 'approved' }); assert.equal(res.s, 409); assert.deepEqual(res.j, { error: 'driver has a live ride' }); assert.equal(st(), before, 'byte-identical state');
  const me = await d('GET', '/api/driver/me'); assert.equal(me.j.profile.plate, 'LR-1'); assert.equal(me.j.change_request.plate, 'LR-2');
  for (const s of ['arrived', 'in_progress', 'completed']) assert.equal((await d('POST', `/api/rides/${acc.j.ride_id}/status`, { status: s })).s, 200);
  const ok = await a('POST', `/api/admin/driver-changes/${ch.j.request_id}/decision`, { decision: 'approved' }); assert.equal(ok.s, 200); assert.deepEqual(ok.j, { ok: true, status: 'approved' });
  assert.deepEqual({ ...b.s.db.prepare('select plate,vehicle_type,car from drivers').get() }, { plate: 'LR-2', vehicle_type: 'moto', car: 'Live' }); await b.close(); });

/* ---- 6. database-level plate uniqueness + real multi-process races ---- */
test('plate uniqueness at the database level: active-vs-pending in both directions, pending-vs-pending, one pending per driver', async () => {
  const b = await boot(); const A = await drv(b, 'DB-A'), B = await drv(b, 'DB-B', false); const db = b.s.db; const idA = db.prepare("select user_id u from drivers where plate='DB-A'").get().u, idB = db.prepare("select user_id u from drivers where plate='DB-B'").get().u;
  assert.equal((await A('POST', '/api/driver/profile', { car: 'x', plate: 'DB-PEND' })).j.change, 'pending');
  const ins = `insert into driver_change_requests(user_id,vehicle_type,car,plate,plate_norm,prev_vehicle_type,prev_car,prev_plate,status)`;
  // direction 1: pending exists, an ACTIVE row tries to take the same plate (update, and insert of a new driver)
  assert.throws(() => db.prepare("update drivers set plate='DB-PEND' where user_id=?").run(idB), /plate_taken/);
  b.s.db.exec("insert into users(id,phone,role) values(901,'+213555999901','driver')"); assert.throws(() => db.prepare("insert into drivers(user_id,car,plate,vehicle_locked) values(901,'c','DB-PEND',0)").run(), /plate_taken/);
  // direction 2: active exists, a PENDING request tries to reserve it
  db.prepare("update driver_change_requests set status='cancelled' where user_id=?").run(idA); assert.throws(() => db.prepare(`${ins} values(?,?,?,?,?,?,?,?,?)`).run(idA, 'car', 'x', 'DB-B', 'DBB', 'car', 'Symbol', 'DB-A', 'pending'), /plate_taken/);
  // pending vs pending (normalized key) and two pending for one driver
  db.prepare(`${ins} values(?,?,?,?,?,?,?,?,?)`).run(idA, 'car', 'x', 'Q-1', 'Q1', 'car', 'Symbol', 'DB-A', 'pending');
  assert.throws(() => db.prepare(`${ins} values(?,?,?,?,?,?,?,?,?)`).run(idB, 'car', 'x', 'q 1', 'Q1', 'car', 'Symbol', 'DB-B', 'pending'), /UNIQUE/);
  assert.throws(() => db.prepare(`${ins} values(?,?,?,?,?,?,?,?,?)`).run(idA, 'car', 'x', 'Q-2', 'Q2', 'car', 'Symbol', 'DB-A', 'pending'), /UNIQUE/);
  assert.throws(() => db.prepare(`${ins} values(?,?,?,?,?,?,?,?,?)`).run(idB, 'boat', 'x', 'Q-3', 'Q3', 'car', 'Symbol', 'DB-B', 'pending'), /CHECK/);
  assert.throws(() => db.prepare("update drivers set vehicle_type='boat' where user_id=?").run(idB), /vehicle_type invalid/);
  // normalized collisions are enforced by the API (inside begin immediate); the DB itself only guarantees exact-match uniqueness
  assert.equal((await B('POST', '/api/driver/profile', { car: 'x', plate: 'db a' })).s, 409); await b.close(); });
function child(file) { return new Promise((res, rej) => { const p = spawn(process.execPath, ['-e', "const {createApp}=require('./server');const s=createApp({dev:true,devAdmin:true,dbPath:process.argv[1],busyTimeout:20000});s.listen(0,'127.0.0.1',()=>console.log('PORT '+s.address().port))", file], { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] });
  p.stdout.on('data', d => { const m = /PORT (\d+)/.exec(String(d)); if (m) res({ p, base: 'http://127.0.0.1:' + m[1] }); }); p.on('error', rej); setTimeout(() => rej(new Error('child timeout')), 15000); }); }
test('true multi-process races (2 OS processes, 1 database file): plate claims, active-vs-pending, admin decisions', async t => {
  const f = path.join(tmp(), 'race.db'); const s1 = await child(f), s2 = await child(f); t.after(() => { s1.p.kill(); s2.p.kill(); });
  const mk = async (srv, plate, lock) => { const c = call(srv.base); await c.login('driver'); if (plate) assert.equal((await c('POST', '/api/driver/profile', { car: 'x', plate })).s, 200); return c; };
  const norms = () => { const db = new DatabaseSync(f, { readOnly: true }); try { const nz = p => p.normalize('NFKC').replace(/[\s\-_.]/g, '').toUpperCase(); const all = [...db.prepare('select plate p from drivers').all(), ...db.prepare("select plate p from driver_change_requests where status='pending'").all()].map(r => nz(r.p)); return all.length - new Set(all).size; } finally { db.close(); } };
  const lockAll = () => { const db = new DatabaseSync(f); db.exec('update drivers set vehicle_locked=1'); db.close(); };
  for (let i = 0; i < 5; i++) { // (a) two brand-new drivers onboard with the same plate in different spellings
    const a = await mk(s1), b = await mk(s2); const rs = await Promise.all([a('POST', '/api/driver/profile', { car: 'x', plate: `ON-${i}-7` }), b('POST', '/api/driver/profile', { car: 'x', plate: `on ${i} 7` })]);
    assert.deepEqual(rs.map(r => r.s).sort(), [200, 409], 'onboarding race round ' + i); assert.equal(norms(), 0); }
  const ps = []; for (let i = 0; i < 5; i++) ps.push([await mk(s1, `PA-${i}`), await mk(s2, `PB-${i}`)]); lockAll();
  for (let i = 0; i < 5; i++) { const [a, b] = ps[i]; // (b) two LOCKED drivers request the same new plate → exactly one pending
    const rs = await Promise.all([a('POST', '/api/driver/profile', { car: 'x', plate: `NP-${i}` }), b('POST', '/api/driver/profile', { car: 'x', plate: `np ${i}` })]);
    assert.deepEqual(rs.map(r => [r.s, r.j.change]).sort(), [[200, 'pending'], [409, undefined]], 'pending race round ' + i); assert.equal(norms(), 0); }
  const us = []; for (let i = 0; i < 5; i++) us.push([await mk(s1, `UA-${i}`), await mk(s2, `UB-${i}`)]); const db0 = new DatabaseSync(f); db0.exec("update drivers set vehicle_locked=1 where plate like 'UA-%'"); db0.close();
  for (let i = 0; i < 5; i++) { const [locked, unlocked] = us[i]; // (c) active-vs-pending: locked driver requests X while an UNLOCKED driver switches to X concurrently
    const rs = await Promise.all([locked('POST', '/api/driver/profile', { car: 'x', plate: `AX-${i}` }), unlocked('POST', '/api/driver/profile', { car: 'x', plate: `ax ${i}` })]);
    assert.deepEqual(rs.map(r => r.s).sort(), [200, 409], 'active-vs-pending race round ' + i); assert.equal(norms(), 0); }
  const adm1 = call(s1.base), adm2 = call(s2.base); for (const a of [adm1, adm2]) assert.equal((await a('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' })).s, 200);
  const rid = (await ps[0][0]('GET', '/api/driver/me')).j.change_request?.id ?? (await ps[0][1]('GET', '/api/driver/me')).j.change_request.id;
  const rs = await Promise.all([adm1('POST', `/api/admin/driver-changes/${rid}/decision`, { decision: 'approved' }), adm2('POST', `/api/admin/driver-changes/${rid}/decision`, { decision: 'rejected', reason: 'no' })]);
  assert.deepEqual(rs.map(r => r.s).sort(), [200, 409], 'only one decision wins'); const db = new DatabaseSync(f, { readOnly: true }); assert.equal(db.prepare("select count(*) c from driver_change_events where request_id=? and action in('approved','rejected')").get(rid).c, 1); db.close(); assert.equal(norms(), 0); });
