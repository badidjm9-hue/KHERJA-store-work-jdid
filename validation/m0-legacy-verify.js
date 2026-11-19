'use strict';
// Usage: node validation/m0-legacy-verify.js <original-phase3.1-root> <new-root>
// 1) builds a realistic legacy DB through the ORIGINAL code's HTTP API, 2) opens it with the NEW code, 3) compares, 4) boots a clean DB.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict'); const { DatabaseSync } = require('node:sqlite');
const [OLD, NEW] = [process.argv[2], process.argv[3]].map(p => path.resolve(p)); const out = []; const ok = (id, d = '') => { out.push(id); console.log('PASS ' + id + (d ? ' :: ' + d : '')); };
const mk = base => { const j = {}; const c = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: Object.entries(j).map(([k, v]) => k + '=' + v).join('; ') }, body: b ? JSON.stringify(b) : undefined }); for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); j[k] = v.join('='); } return { s: r.status, j: await r.json().catch(() => ({})) }; }; c.login = async (ph, role, name) => { await c('POST', '/api/auth/otp', { phone: ph }); const r = await c('POST', '/api/auth/verify', { phone: ph, code: '123456', role, name }); assert.equal(r.s, 200); }; return c; };
const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(400, 9)]).toString('base64');
const P = { lat: 36.75, lng: 3.05, label: 'A' }, D = { lat: 36.69, lng: 3.21, label: 'B' };
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-legacy-')), file = path.join(dir, 'legacy.db');
  const old = require(path.join(OLD, 'backend/server.js')).createApp({ dev: true, devAdmin: true, dbPath: file }); await new Promise(r => old.listen(0, r)); const base = 'http://127.0.0.1:' + old.address().port;
  const adm = mk(base); await adm.login('0550000000', 'rider').catch(() => {}); const A = mk(base); assert.equal((await A('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' })).s, 200);
  const riders = [], drivers = []; for (let i = 0; i < 4; i++) { const r = mk(base); await r.login('0556000' + (100 + i), 'rider', 'R' + i); riders.push(r); }
  const plates = ['04721-116-16', '10234-110-31', '00077-100-16', '55555-107-09', '12121-119-25', '33333-100-16'];
  for (let i = 0; i < 6; i++) { const d = mk(base); await d.login('0557000' + (100 + i), 'driver', 'D' + i); assert.equal((await d('POST', '/api/driver/profile', { car: 'Car' + i, plate: plates[i], vehicle_type: i === 3 ? 'moto' : 'car' })).s, 200); drivers.push(d); }
  const docIds = n => null; for (const i of [0, 1, 3]) for (const k of ['vehicle_photo', 'license', 'registration', 'insurance']) { const r = await drivers[i]('POST', '/api/driver/docs', { kind: k, data: jpg() }); assert.equal(r.s, 200); assert.equal((await A('POST', `/api/admin/docs/${r.j.id}/review`, { status: 'approved' })).s, 200); }
  { const r = await drivers[2]('POST', '/api/driver/docs', { kind: 'license', data: jpg() }); await A('POST', `/api/admin/docs/${r.j.id}/review`, { status: 'rejected', reason: 'blurry' }); }   // driver 2: rejected
  { await drivers[4]('POST', '/api/driver/docs', { kind: 'license', data: jpg() }); }                                                                                                      // driver 4: pending doc, unreviewed
  await A('POST', '/api/admin/drivers/' + old.db.prepare("select user_id u from drivers where plate=?").get(plates[1]).u + '/suspend', { suspended: true, reason: 'test' });          // driver 1: suspended
  for (const i of [0, 3]) assert.equal((await drivers[i]('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 })).s, 200);
  let completed = 0; for (let i = 0; i < 3; i++) { const rq = await riders[i]('POST', '/api/requests', { pickup: P, dropoff: D, price: 400 + i * 50, vehicle_type: 'car' }); const of = await drivers[0]('POST', `/api/requests/${rq.j.id}/offers`, { price: 450 + i * 50, eta_min: 3 });
    const acc = await riders[i]('POST', `/api/offers/${of.j.id}/accept`); for (const st of i < 2 ? ['arrived', 'in_progress', 'completed'] : ['arrived']) assert.equal((await drivers[0]('POST', `/api/rides/${acc.j.ride_id}/status`, { status: st })).s, 200); if (i < 2) { completed++; await riders[i]('POST', `/api/rides/${acc.j.ride_id}/rating`, { stars: 5 - i, tags: ['clean'] }); }
    if (i === 0) await riders[i]('POST', `/api/rides/${acc.j.ride_id}/report`, { kind: 'price_dispute', body: 'asked more' }); }
  { const rq = await riders[3]('POST', '/api/requests', { pickup: P, dropoff: D, price: 300, vehicle_type: 'moto' }); await drivers[3]('POST', `/api/requests/${rq.j.id}/offers`, { price: 320, eta_min: 5 }); } // an in-flight pending offer at upgrade time
  await new Promise(r => old.close(r)); fs.copyFileSync(file, file + '.pre-m0.bak');
  const T = { users: 'id,phone,name,role,lang,city,prefers_women,created_at', drivers: 'user_id,car,plate,online,lat,lng,is_woman,docs_status,vehicle_type,suspended', requests: '*', rides: '*', audit: '*', driver_docs: '*', ratings: '*', reports: '*', offers: 'id,request_id,driver_id,price,eta_min,created_at', safety_contacts: '*' };
  const snap = f => { const db = new DatabaseSync(f, { readOnly: true }); try { return Object.fromEntries(Object.entries(T).map(([t, c]) => [t, db.prepare(`select ${c} from ${t} order by 1,2`).all().map(r => ({ ...r }))])); } finally { db.close(); } };
  const before = snap(file); const cnt = o => Object.entries(o).map(([k, v]) => k + '=' + v.length).join(' '); console.log('legacy data: ' + cnt(before));
  assert.ok(before.drivers.length === 6 && before.rides.length === 3 && before.audit.length >= 14);
  const nw = require(path.join(NEW, 'backend/server.js')).createApp({ dev: true, dbPath: file }); const after = snap(file);
  { const h = f => { const db = new DatabaseSync(f, { readOnly: true }); try { return db.prepare('select id,role,password_hash is null n from users where password_hash is not null or role=\'admin\'').all().map(r => ({ ...r })); } finally { db.close(); } };
    const a = h(file + '.pre-m0.bak'), b = h(file); assert.deepEqual(a.map(r => [r.id, r.role, !!r.n]), [[1, 'admin', false]]); assert.deepEqual(b.map(r => [r.id, r.role, !!r.n]), [[1, 'admin', true]]); ok('legacy.dev_admin_password_neutralised', 'pre-existing behaviour: booting without dev-admin mode nulls the known dev admin password; the only users change'); }
  for (const t of Object.keys(T)) assert.deepEqual(after[t], before[t], t + ' changed'); ok('legacy.data_identical_after_migration', cnt(after));
  const lk = Object.fromEntries(nw.db.prepare('select plate,vehicle_locked l from drivers').all().map(r => [r.plate, r.l])); console.log('locks: ' + JSON.stringify(lk));
  assert.deepEqual(lk, { [plates[0]]: 1, [plates[1]]: 1, [plates[2]]: 1, [plates[3]]: 1, [plates[4]]: 1, [plates[5]]: 0 }); ok('legacy.locks_fail_closed', 'approved, suspended, rejected, unreviewed-doc drivers LOCKED; only the document-less, activity-less driver unlocked');
  assert.deepEqual(nw.db.prepare('select status from offers order by id').all().map(r => r.status), ['accepted', 'accepted', 'accepted', 'expired']); ok('legacy.offers', 'accepted offers untouched; in-flight pending offer expired');
  assert.equal(nw.db.prepare('select count(*) c from driver_change_requests').get().c, 0); assert.deepEqual([nw.db.prepare('pragma integrity_check').get().integrity_check, nw.db.prepare('pragma foreign_key_check').all().length], ['ok', 0]); ok('legacy.integrity', 'integrity_check ok, foreign_key_check 0');
  assert.throws(() => nw.db.prepare('update rides set locked_price=1').run(), /immutable/); ok('legacy.locked_price_still_immutable');
  await new Promise(r => nw.listen(0, r)); const nb = 'http://127.0.0.1:' + nw.address().port; const d0 = mk(nb); await d0.login('0557000100', 'driver'); // existing approved driver logs in again
  const me = await d0('GET', '/api/driver/me'); assert.equal(me.j.profile.plate, plates[0]); assert.equal(me.j.profile.approval_required, true); assert.equal(me.j.can_go_online, true, 'dev mode does not require approval'); 
  await new Promise(r => nw.close(r));
  const cdir = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-clean-')); const cs = require(path.join(NEW, 'backend/server.js')).createApp({ dev: true, dbPath: path.join(cdir, 'clean.db') });
  const names = cs.db.prepare("select name from sqlite_master where name in('driver_change_requests','driver_change_events','vehicle_lock_irreversible','offer_expiry_immutable','dce_no_delete','one_pending_plate_norm')").all().length; assert.equal(names, 6);
  assert.equal(cs.db.prepare("select dflt_value d from pragma_table_info('drivers') where name='vehicle_locked'").get().d, '1'); assert.equal(cs.db.prepare('select count(*) c from drivers').get().c, 0); ok('clean.schema', 'all M0 objects present; vehicle_locked default 1 (fail closed); 0 rows'); cs.close();
  console.log('SUMMARY pass=' + out.length + ' fail=0');
})().catch(e => { console.log('FAIL ' + (e.stack || e).split('\n').slice(0, 4).join(' | ')); process.exit(1); });
