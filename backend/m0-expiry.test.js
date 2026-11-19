const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { createApp } = require('./server');
let n = 0;
const P = { lat: 36.75, lng: 3.05, label: 'A' }, D = { lat: 36.69, lng: 3.21, label: 'B' };
const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(400, 7)]).toString('base64');
async function boot(opts = {}) {
  const clock = { t: 1_800_000_000_000 }; const s = createApp({ dev: true, devAdmin: true, now: () => clock.t, ...opts });
  await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {};
    const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') }, body: b ? JSON.stringify(b) : undefined });
      for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); } return { s: r.status, j: await r.json() }; };
    return { call, login: async (role, name) => { const phone = '0555' + String(200000 + n++); await call('POST', '/api/auth/otp', { phone }); const r = await call('POST', '/api/auth/verify', { phone, code: '123456', role, name }); assert.equal(r.s, 200); return r; } }; };
  return { s, clock, client };
}
async function driverOf(b, plate, lat = 36.76) { const d = b.client(); await d.login('driver', 'D'); const r = await d.call('POST', '/api/driver/profile', { car: 'Symbol', plate }); assert.equal(r.s, 200);
  await d.call('POST', '/api/driver/online', { online: true, lat, lng: 3.06 }); return d; }
async function riderReq(b) { const r = b.client(); await r.login('rider', 'R'); const q = await r.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 450 }); return { r, id: q.j.id }; }

/* ---------- 15-second offer expiry ---------- */
test('offer carries one server-side 15 s deadline; boundary 14999 ms accepts, 15000 ms does not', async () => {
  for (const [dt, ok] of [[14999, true], [15000, false]]) {
    const b = await boot(); const d = await driverOf(b, 'P-' + dt); const { r, id } = await riderReq(b);
    const t0 = b.clock.t; const of = await d.call('POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 }); assert.equal(of.j.expires_at, t0 + 15000);
    assert.equal(b.s.db.prepare('select expires_at e from offers where id=?').get(of.j.id).e, t0 + 15000);
    b.clock.t = t0 + dt; const acc = await r.call('POST', `/api/offers/${of.j.id}/accept`);
    if (ok) { assert.equal(acc.s, 200); assert.equal(acc.j.locked_price, 500); }
    else { assert.equal(acc.s, 409); assert.equal(acc.j.error, 'offer expired'); assert.equal(b.s.db.prepare('select count(*) c from rides').get().c, 0);
      assert.equal(b.s.db.prepare('select status from requests where id=?').get(id).status, 'open'); assert.equal(b.s.db.prepare('select status from offers where id=?').get(of.j.id).status, 'expired'); }
    b.s.close(); } });
test('expired offers vanish from the list, each driver has an independent deadline, refresh does not restore them', async () => {
  const b = await boot(); const d1 = await driverOf(b, 'A-1'), d2 = await driverOf(b, 'A-2'); const { r, id } = await riderReq(b); const t0 = b.clock.t;
  const o1 = await d1.call('POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 }); b.clock.t = t0 + 6000;
  const o2 = await d2.call('POST', `/api/requests/${id}/offers`, { price: 480, eta_min: 5 });
  let l = await r.call('GET', `/api/requests/${id}/offers`); assert.equal(l.j.offers.length, 2); assert.equal(l.j.offers.find(o => o.id === o1.j.id).expires_at, t0 + 15000); assert.equal(l.j.offers.find(o => o.id === o2.j.id).expires_at, t0 + 21000);
  b.clock.t = t0 + 15000; l = await r.call('GET', `/api/requests/${id}/offers`); assert.deepEqual(l.j.offers.map(o => o.id), [o2.j.id]);
  assert.equal((await r.call('POST', `/api/offers/${o1.j.id}/accept`)).s, 409); l = await r.call('GET', `/api/requests/${id}/offers`); assert.deepEqual(l.j.offers.map(o => o.id), [o2.j.id], 'refresh keeps it gone');
  const mine = await d1.call('GET', '/api/driver/offers'); assert.equal(mine.j.offers[0].status, 'expired');
  assert.equal((await r.call('POST', `/api/offers/${o2.j.id}/accept`)).s, 200); assert.equal((await d2.call('GET', '/api/driver/offers')).j.offers[0].status, 'accepted'); b.s.close(); });
test('selecting a driver declines the others; driver sees the outcome; accepted price is immutable', async () => {
  const b = await boot(); const d1 = await driverOf(b, 'S-1'), d2 = await driverOf(b, 'S-2'); const { r, id } = await riderReq(b);
  const o1 = await d1.call('POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 }); await d2.call('POST', `/api/requests/${id}/offers`, { price: 470, eta_min: 5 });
  const acc = await r.call('POST', `/api/offers/${o1.j.id}/accept`); assert.equal(acc.s, 200);
  assert.equal((await d2.call('GET', '/api/driver/offers')).j.offers[0].status, 'declined'); assert.equal((await r.call('POST', `/api/offers/${o1.j.id}/accept`)).s, 409);
  assert.throws(() => b.s.db.prepare('update rides set locked_price=1').run(), /immutable/);
  assert.throws(() => b.s.db.prepare('update offers set expires_at=expires_at+1000').run(), /immutable/); b.s.close(); });
test('concurrent accepts of the same offer create exactly one ride; accept racing expiry never yields a ride after the deadline', async () => {
  const b = await boot(); const d = await driverOf(b, 'C-1'); const { r, id } = await riderReq(b); const of = await d.call('POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 });
  const res = await Promise.all([1, 2, 3, 4, 5].map(() => r.call('POST', `/api/offers/${of.j.id}/accept`))); assert.equal(res.filter(x => x.s === 200).length, 1); assert.equal(b.s.db.prepare('select count(*) c from rides').get().c, 1);
  const b2 = await boot(); const d2 = await driverOf(b2, 'C-2'); const q = await riderReq(b2); const o = await d2.call('POST', `/api/requests/${q.id}/offers`, { price: 500, eta_min: 3 }); b2.clock.t += 15000;
  const r2 = await Promise.all([1, 2, 3].map(() => q.r.call('POST', `/api/offers/${o.j.id}/accept`))); assert.ok(r2.every(x => x.s === 409)); assert.equal(b2.s.db.prepare('select count(*) c from rides').get().c, 0); b.s.close(); b2.s.close(); });
test('expiry is persisted: after a restart an expired offer stays expired; legacy pending offers are expired (fail closed)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k-')), file = path.join(dir, 'k.db'); const b = await boot({ dbPath: file }); const d = await driverOf(b, 'R-1'); const { id } = await riderReq(b);
  const of = await d.call('POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 }); const t = b.clock.t; await new Promise(r => b.s.close(r));
  const s2 = createApp({ dev: true, dbPath: file, now: () => t + 20000 }); assert.equal(s2.db.prepare('select status from offers where id=?').get(of.j.id).status, 'expired'); await new Promise(r => s2.close(r));
  const leg = new DatabaseSync(path.join(dir, 'leg.db')); const mig = f => fs.readFileSync(path.join(__dirname, 'migrations', f), 'utf8'); leg.exec(mig('001_init.sql') + mig('002_admin.sql'));
  leg.exec("insert into users(id,phone,role) values(1,'+213555000001','rider'),(2,'+213555000002','driver'); insert into drivers(user_id,car,plate) values(2,'x','L1'); insert into requests(id,rider_id,p_lat,p_lng,p_label,d_lat,d_lng,d_label,price,expires_at) values(1,1,1,1,'a',2,2,'b',500,9e15); insert into offers(request_id,driver_id,price,eta_min) values(1,2,500,3);"); leg.close();
  const s3 = createApp({ dev: true, dbPath: path.join(dir, 'leg.db') }); assert.equal(s3.db.prepare('select status from offers').get().status, 'expired'); await new Promise(r => s3.close(r)); });

/* ---------- M0 vehicle approval ---------- */
async function lockedDriver(b, plate) { const d = await driverOf(b, plate); b.s.db.prepare('update drivers set vehicle_locked=1 where plate=?').run(plate); return d; }
const adminLogin = async b => { const a = b.client(); assert.equal((await a.call('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' })).s, 200); return a; };
const row = (b, plate) => b.s.db.prepare('select * from drivers where plate=?').get(plate);

test('unlocked driver edits apply at once; locked driver edits become a pending request and nothing changes', async () => {
  const b = await boot(); const d = await driverOf(b, 'U-1'); let r = await d.call('POST', '/api/driver/profile', { car: 'Clio', plate: 'U-1', vehicle_type: 'car' }); assert.equal(r.j.change, 'applied'); assert.equal(row(b, 'U-1').car, 'Clio');
  b.s.db.prepare('update drivers set vehicle_locked=1').run(); r = await d.call('POST', '/api/driver/profile', { car: 'Golf', plate: 'U-2', vehicle_type: 'moto' });
  assert.equal(r.j.change, 'pending'); const cur = row(b, 'U-1'); assert.equal(cur.car, 'Clio'); assert.equal(cur.vehicle_type, 'car'); assert.equal(b.s.db.prepare('select count(*) c from drivers where plate=?').get('U-2').c, 0);
  assert.equal((await d.call('POST', '/api/driver/profile', { car: 'Clio', plate: 'U-1' })).j.change, 'none');
  const me = await d.call('GET', '/api/driver/me'); assert.equal(me.j.change_request.plate, 'U-2'); assert.equal(me.j.profile.approval_required, true);
  const r2 = await d.call('POST', '/api/driver/profile', { car: 'Golf', plate: 'U-3' }); assert.equal(r2.j.change, 'pending');
  assert.equal(b.s.db.prepare("select status from driver_change_requests where id=?").get(r.j.request_id).status, 'superseded'); b.s.close(); });
test('pending values never reach passengers; vehicle_locked cannot be reset or mass-assigned', async () => {
  const b = await boot(); const d = await lockedDriver(b, 'M-1'); await d.call('POST', '/api/driver/profile', { car: 'Secret', plate: 'SECRET-1' }); const { r, id } = await riderReq(b);
  await d.call('POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 }); assert.ok(!JSON.stringify((await r.call('GET', `/api/requests/${id}/offers`)).j).match(/SECRET/));
  for (const evil of [{ vehicle_locked: 0 }, { vehicle_locked: false }, { vehicle_locked: '0' }, { locked: 0, docs_status: 'pending' }, { __proto__: { vehicle_locked: 0 } }, JSON.parse('{"constructor":{"prototype":{"vehicle_locked":0}}}')])
    await d.call('POST', '/api/driver/profile', { car: 'Symbol', plate: 'M-1', ...evil }), assert.equal(row(b, 'M-1').vehicle_locked, 1);
  assert.throws(() => b.s.db.prepare('update drivers set vehicle_locked=0').run(), /irreversible/);
  assert.equal(b.s.db.prepare('select sql from sqlite_master where name=?').get('vehicle_lock_irreversible') != null, true);
  const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8').split('\n').filter(l => /vehicle_locked/.test(l)); assert.ok(src.every(l => /alter table|update drivers set vehicle_locked=|insert into drivers\(.*vehicle_locked|vehicle_locked,docs|vehicle_locked from drivers|d\.vehicle_locked|vehicle_locked\b.*(delete|create trigger)|d\.vehicle_locked|b\.is_woman|create trigger|vehicle_locked=0|vehicle_locked integer|approval_required|vehicle_lock/.test(l)), 'unexpected vehicle_locked writer'); b.s.close(); });
test('admin approve / reject with required reason, atomic and audited; driver cancel is explicit and owner-only', async () => {
  const b = await boot(); const d = await lockedDriver(b, 'A-9'), other = await lockedDriver(b, 'A-8'), adm = await adminLogin(b), rider = b.client(); await rider.login('rider', 'x');
  const r = await d.call('POST', '/api/driver/profile', { car: 'New', plate: 'A-90', vehicle_type: 'moto' }); const id = r.j.request_id;
  assert.equal((await adm.call('POST', `/api/admin/driver-changes/${id}/decision`, { decision: 'rejected' })).s, 400, 'reason required');
  assert.equal((await d.call('POST', `/api/admin/driver-changes/${id}/decision`, { decision: 'approved' })).s, 401, 'driver cannot decide');
  assert.equal((await other.call('POST', '/api/driver/vehicle-change/cancel', { request_id: id })).s, 404, 'not owner'); assert.equal((await rider.call('POST', '/api/driver/vehicle-change/cancel', { request_id: id })).s, 403);
  assert.equal((await adm.call('POST', `/api/admin/driver-changes/${id}/decision`, { decision: 'rejected', reason: 'blurry' })).s, 200); assert.equal(row(b, 'A-9').car, 'Symbol');
  assert.equal((await d.call('GET', '/api/driver/me')).j.last_rejection.reason, 'blurry'); assert.equal((await d.call('POST', '/api/driver/vehicle-change/cancel', { request_id: id })).s, 409);
  const r2 = await d.call('POST', '/api/driver/profile', { car: 'New', plate: 'A-91', vehicle_type: 'moto' }); assert.equal((await d.call('POST', '/api/driver/vehicle-change/cancel', { request_id: r2.j.request_id })).s, 200);
  const r3 = await d.call('POST', '/api/driver/profile', { car: 'New', plate: 'A-92', vehicle_type: 'moto' }); assert.equal((await adm.call('POST', `/api/admin/driver-changes/${r3.j.request_id}/decision`, { decision: 'approved' })).s, 200);
  const nr = row(b, 'A-9') || row(b, 'A-92'); assert.equal(nr.vehicle_type, 'moto'); assert.equal(nr.plate, 'A-92'); assert.equal((await adm.call('POST', `/api/admin/driver-changes/${r3.j.request_id}/decision`, { decision: 'approved' })).s, 409);
  assert.equal(b.s.db.prepare("select count(*) c from audit where action like 'driver_change_%'").get().c, 2); assert.ok(b.s.db.prepare('select count(*) c from driver_change_events').get().c >= 6);
  assert.throws(() => b.s.db.prepare('delete from driver_change_events').run(), /append-only`?/); b.s.close(); });
test('plate uniqueness: normalized (case, separators, Arabic digits) across active and pending', async () => {
  const b = await boot(); await driverOf(b, '04721-116-16'); const d2 = await driverOf(b, 'Z-5'); const dup = b.client(); await dup.login('driver', 'y');
  assert.equal((await dup.call('POST', '/api/driver/profile', { car: 'x', plate: '٠٤٧٢١ 116.16' })).s, 409);
  b.s.db.prepare('update drivers set vehicle_locked=1').run(); assert.equal((await d2.call('POST', '/api/driver/profile', { car: 'x', plate: '04721_116_16' })).s, 409);
  assert.equal((await d2.call('POST', '/api/driver/profile', { car: 'x', plate: 'new-77' })).j.change, 'pending'); assert.equal((await dup.call('POST', '/api/driver/profile', { car: 'x', plate: 'NEW 77' })).s, 409, 'pending plates are reserved'); b.s.close(); });
test('validation: bad vehicle_type 400 on profile, ride and delivery; document review locks the vehicle', async () => {
  const b = await boot(); const d = b.client(); await d.login('driver', 'v'); assert.equal((await d.call('POST', '/api/driver/profile', { car: 'x', plate: 'V-1', vehicle_type: 'boat' })).s, 400);
  assert.equal((await d.call('POST', '/api/driver/profile', { car: 'x', plate: 'V-1', is_woman: 'yes' })).s, 400); await d.call('POST', '/api/driver/profile', { car: 'x', plate: 'V-1' });
  const r = b.client(); await r.login('rider', 'r'); assert.equal((await r.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400, vehicle_type: 'boat' })).s, 400);
  assert.equal((await r.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400, kind: 'delivery', item_type: 'parcel', item_note: 'x', vehicle_type: 'boat' })).s, 400);
  assert.equal(row(b, 'V-1').vehicle_locked, 0); const doc = await d.call('POST', '/api/driver/docs', { kind: 'license', data: jpg() }); const adm = await adminLogin(b);
  assert.equal((await adm.call('POST', `/api/admin/docs/${doc.j.id}/review`, { status: 'rejected', reason: 'blur' })).s, 200); assert.equal(row(b, 'V-1').vehicle_locked, 1); b.s.close(); });
test('accept re-validates the driver: offline after offering → 409, offer declined, no ride', async () => {
  const b = await boot(); const d = await driverOf(b, 'RV-1'); const { r, id } = await riderReq(b); const of = await d.call('POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 });
  await d.call('POST', '/api/driver/online', { online: false }); const acc = await r.call('POST', `/api/offers/${of.j.id}/accept`); assert.equal(acc.s, 409);
  assert.equal(b.s.db.prepare('select status from offers').get().status, 'declined'); assert.equal(b.s.db.prepare('select count(*) c from rides').get().c, 0); assert.equal(b.s.db.prepare('select status from requests').get().status, 'open'); b.s.close(); });
test('legacy migration is fail-closed: only a pristine driver is unlocked; second boot changes nothing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k-')), file = path.join(dir, 'l.db'); const mig = f => fs.readFileSync(path.join(__dirname, 'migrations', f), 'utf8'); const db = new DatabaseSync(file); db.exec(mig('001_init.sql') + mig('002_admin.sql'));
  db.exec(`insert into users(id,phone,role) values(1,'+213555000001','rider'),(2,'+213555000002','driver'),(3,'+213555000003','driver'),(4,'+213555000004','driver'),(5,'+213555000005','driver'),(6,'+213555000006','driver'),(10,'+213555000010','driver');
    insert into drivers(user_id,car,plate,docs_status) values(2,'c','P2','approved'),(3,'c','P3','pending'),(4,'c','P4','rejected'),(5,'c','P5','pending'),(6,'c','P6','weird'),(10,'c','P10','pending');
    insert into driver_docs(user_id,kind,mime,file,size) values(3,'license','image/jpeg','f',300); insert into audit(admin_id,action,target) values(1,'x','user:1');`); db.exec("update drivers set online=1 where user_id=5"); db.close();
  const s = createApp({ dev: true, dbPath: file }); const lk = () => Object.fromEntries(s.db.prepare('select user_id u,vehicle_locked l from drivers').all().map(r => [r.u, r.l]));
  assert.deepEqual(lk(), { 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 10: 0 }, 'user:1 audit must not match user:10'); await new Promise(r => s.close(r));
  const s2 = createApp({ dev: true, dbPath: file }); s2.db.prepare('update drivers set vehicle_locked=1 where user_id=10').run(); await new Promise(r => s2.close(r));
  const s3 = createApp({ dev: true, dbPath: file }); assert.equal(s3.db.prepare('select vehicle_locked l from drivers where user_id=10').get().l, 1, 'no reclassification on reboot'); await new Promise(r => s3.close(r)); });
