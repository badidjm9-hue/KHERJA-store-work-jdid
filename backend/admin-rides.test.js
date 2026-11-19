// GET /api/admin/rides: named SQLite parameters (:st, :like) and admin-only access.
// Run: node --test backend/admin-rides.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');

async function boot() {
  const s = createApp({ dev: true, devAdmin: true }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {};
    const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') }, body: b && m !== 'GET' ? JSON.stringify(b) : undefined });
      for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); }
      return { s: r.status, j: r.headers.get('content-type')?.includes('json') ? await r.json() : {} }; };
    const login = async (role, phone, name) => { await call('POST', '/api/auth/otp', { phone }); const r = await call('POST', '/api/auth/verify', { phone, code: '123456', role, name }); assert.equal(r.s, 200); return r; };
    return { call, login }; };
  return { s, client, stop: () => new Promise(r => s.close(r)) };
}
const A = { lat: 36.75, lng: 3.05, label: 'A' }, B = { lat: 36.69, lng: 3.21, label: 'B' };

// ride 1: Amine/Karim, completed. ride 2: Sara/Yacine, left en_route. Returns an authenticated admin client.
async function seed(b) {
  const out = {};
  for (const [key, rp, rn, dp, dn, finish] of [['r1', '0555200001', 'Amine', '0555200002', 'Karim', true], ['r2', '0555200003', 'Sara', '0555200004', 'Yacine', false]]) {
    const rider = b.client(), driver = b.client(); await rider.login('rider', rp, rn); await driver.login('driver', dp, dn);
    const pr = await driver.call('POST', '/api/driver/profile', { car: 'Symbol', plate: key === 'r1' ? '04721-116-16' : '05812-117-16' }); assert.equal(pr.s, 200, 'profile ' + key + ' ' + JSON.stringify(pr.j)); const on = await driver.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 }); assert.equal(on.s, 200, 'online ' + key + ' ' + JSON.stringify(on.j));
    const rq = await rider.call('POST', '/api/requests', { pickup: A, dropoff: B, price: 400 }); assert.equal(rq.s, 200, 'request ' + key + ' ' + JSON.stringify(rq.j));
    const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: key === 'r1' ? 450 : 500, eta_min: 3 }); assert.equal(of.s, 200, 'offer ' + key + ' ' + JSON.stringify(of.j));
    const acc = await rider.call('POST', `/api/offers/${of.j.id}/accept`); assert.equal(acc.s, 200); out[key] = { rideId: acc.j.ride_id, rider, driver };
    if (finish) for (const st of ['arrived', 'in_progress', 'completed']) assert.equal((await driver.call('POST', `/api/rides/${acc.j.ride_id}/status`, { status: st })).s, 200);
  }
  const adm = b.client(); assert.equal((await adm.call('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' })).s, 200);
  out.adm = adm; return out;
}
const ids = r => r.j.rides.map(x => x.id);
const list = async (adm, qs = '') => { const r = await adm.call('GET', '/api/admin/rides' + qs); assert.equal(r.s, 200, 'GET /api/admin/rides' + qs + ' -> ' + r.s); return r; };

test('admin rides: access control', async () => {
  const b = await boot(); try { const x = await seed(b);
    assert.equal((await b.client().call('GET', '/api/admin/rides')).s, 401, 'no session');
    assert.equal((await x.r1.rider.call('GET', '/api/admin/rides')).s, 401, 'rider session');
    assert.equal((await x.r1.driver.call('GET', '/api/admin/rides')).s, 401, 'driver session');
    assert.equal((await x.adm.call('GET', '/api/admin/rides')).s, 200);
  } finally { await b.stop(); } });

test('admin rides: default listing, ordering and exact response shape', async () => {
  const b = await boot(); try { const x = await seed(b); const r = await list(x.adm);
    assert.deepEqual(ids(r), [x.r2.rideId, x.r1.rideId], 'newest first');
    assert.deepEqual(Object.keys(r.j.rides[0]).sort(), ['created_at', 'd_label', 'driver_name', 'driver_phone', 'id', 'item_type', 'kind', 'p_label', 'price', 'rider_name', 'rider_phone', 'status'], 'no extra columns leak');
    const one = r.j.rides.find(v => v.id === x.r1.rideId); assert.equal(one.price, 450, 'locked price, not the rider proposal'); assert.equal(one.status, 'completed'); assert.equal(one.rider_name, 'Amine'); assert.equal(one.driver_name, 'Karim');
  } finally { await b.stop(); } });

test('admin rides: status filter (:st)', async () => {
  const b = await boot(); try { const x = await seed(b);
    assert.deepEqual(ids(await list(x.adm, '?status=completed')), [x.r1.rideId]);
    assert.deepEqual(ids(await list(x.adm, '?status=en_route')), [x.r2.rideId]);
    assert.equal((await list(x.adm, '?status=cancelled')).j.rides.length, 0);
    assert.equal((await list(x.adm, '?status=not_a_status')).j.rides.length, 0, 'unknown status is an empty result, not an error');
    assert.equal((await list(x.adm, '?status=')).j.rides.length, 2, 'empty status means no filter');
  } finally { await b.stop(); } });

test('admin rides: search (:like) across rider/driver name and phone', async () => {
  const b = await boot(); try { const x = await seed(b);
    assert.deepEqual(ids(await list(x.adm, '?q=Amine')), [x.r1.rideId], 'rider name');
    assert.deepEqual(ids(await list(x.adm, '?q=karim')), [x.r1.rideId], 'driver name, case-insensitive');
    assert.deepEqual(ids(await list(x.adm, '?q=SARA')), [x.r2.rideId]);
    assert.deepEqual(ids(await list(x.adm, '?q=Yacine')), [x.r2.rideId], 'driver name of ride 2');
    assert.deepEqual(ids(await list(x.adm, '?q=555200001')), [x.r1.rideId], 'rider phone substring (stored as +213...)');
    assert.deepEqual(ids(await list(x.adm, '?q=' + encodeURIComponent('+213555200004'))), [x.r2.rideId], 'driver phone, international form');
    assert.equal((await list(x.adm, '?q=nobody')).j.rides.length, 0);
    assert.equal((await list(x.adm, '?q=')).j.rides.length, 2, 'empty q means no filter');
  } finally { await b.stop(); } });

test('admin rides: status and search combine; both named parameters bind together', async () => {
  const b = await boot(); try { const x = await seed(b);
    assert.deepEqual(ids(await list(x.adm, '?status=completed&q=Amine')), [x.r1.rideId]);
    assert.equal((await list(x.adm, '?status=en_route&q=Amine')).j.rides.length, 0, 'status excludes the name match');
    assert.equal((await list(x.adm, '?status=completed&q=Sara')).j.rides.length, 0, 'name excludes the status match');
    assert.deepEqual(ids(await list(x.adm, '?status=en_route&q=Yacine')), [x.r2.rideId]);
  } finally { await b.stop(); } });

test('admin rides: LIKE wildcards are stripped and SQL text in parameters is inert', async () => {
  const b = await boot(); try { const x = await seed(b);
    for (const q of ['%', '_', '%%%', '___', '\\']) assert.equal((await list(x.adm, '?q=' + encodeURIComponent(q))).j.rides.length, 2, 'wildcard-only term "' + q + '" matches everything, never errors');
    assert.deepEqual(ids(await list(x.adm, '?q=' + encodeURIComponent('A%mine'))), [x.r1.rideId], 'wildcard inside a term is removed, not interpreted');
    for (const evil of ["' OR 1=1 --", "'; DROP TABLE rides; --", '" OR ""="']) {
      assert.equal((await list(x.adm, '?q=' + encodeURIComponent(evil))).j.rides.length, 0, 'q injection: ' + evil);
      assert.equal((await list(x.adm, '?status=' + encodeURIComponent(evil))).j.rides.length, 0, 'status injection: ' + evil);
    }
    assert.equal((await list(x.adm)).j.rides.length, 2, 'table intact after injection attempts');
    assert.equal((await list(x.adm, '?q=' + 'a'.repeat(5000))).j.rides.length, 0, 'very long q is truncated and answered normally');
  } finally { await b.stop(); } });

test('admin rides: result is capped at 100 rows, newest first', async () => {
  const b = await boot(); try { const x = await seed(b); const db = b.s.db;
    const cols = t => db.prepare(`pragma table_info(${t})`).all().map(c => c.name).filter(c => c !== 'id');
    const rc = cols('requests'), oc = cols('offers'), kc = cols('rides');
    const srcRide = db.prepare('select * from rides where id=?').get(x.r1.rideId), srcOffer = db.prepare('select * from offers where id=?').get(srcRide.offer_id), srcReq = db.prepare('select * from requests where id=?').get(srcRide.request_id);
    db.exec('begin');
    for (let i = 0; i < 105; i++) {
      const rq = db.prepare(`insert into requests(${rc.join(',')}) values(${rc.map(() => '?').join(',')})`).run(...rc.map(c => srcReq[c])).lastInsertRowid;
      const of = db.prepare(`insert into offers(${oc.join(',')}) values(${oc.map(() => '?').join(',')})`).run(...oc.map(c => c === 'request_id' ? rq : srcOffer[c])).lastInsertRowid;
      db.prepare(`insert into rides(${kc.join(',')}) values(${kc.map(() => '?').join(',')})`).run(...kc.map(c => c === 'request_id' ? rq : c === 'offer_id' ? of : c === 'status' ? 'completed' : srcRide[c]));
    }
    db.exec('commit');
    const total = db.prepare('select count(*) n from rides').get().n; assert.equal(total, 107);
    const r = await list(x.adm); assert.equal(r.j.rides.length, 100);
    assert.deepEqual(ids(r), [...ids(r)].sort((p, q) => q - p), 'descending ids');
    assert.equal(r.j.rides[0].id, db.prepare('select max(id) m from rides').get().m, 'newest ride is first');
    assert.equal((await list(x.adm, '?q=Amine')).j.rides.length, 100, 'cap applies to filtered results too');
  } finally { await b.stop(); } });
