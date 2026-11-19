// Phase 2: the backend is the only authority for roles. Proves the one-app shell can rely on it.
// Run: node --test backend/roles.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
let n = 0;
async function boot(opts) {
  const s = createApp({ dev: true, devAdmin: true, ...opts }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {}; const cookie = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    const call = async (m, p, b, extra = {}) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: cookie(), ...extra }, body: b && m !== 'GET' ? JSON.stringify(b) : undefined });
      for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); }
      return { s: r.status, j: r.headers.get('content-type')?.includes('json') ? await r.json() : {} }; };
    const verify = async (phone, role) => { await call('POST', '/api/auth/otp', { phone }); return call('POST', '/api/auth/verify', { phone, code: '123456', role, name: 'T' }); };
    return { call, jar, verify, login: async role => verify('0555' + String(700000 + n++), role) }; };
  return { s: s, client, base, stop: () => new Promise(r => s.close(r)) };
}

const DRIVER_ONLY = [['GET', '/api/driver/me'], ['POST', '/api/driver/profile'], ['POST', '/api/driver/docs'], ['POST', '/api/driver/online'], ['GET', '/api/driver/requests'], ['POST', '/api/requests/1/offers']];
const RIDER_ONLY = [['POST', '/api/requests'], ['POST', '/api/offers/1/accept']];
const ADMIN_ONLY = [['GET', '/api/admin/me'], ['GET', '/api/admin/stats'], ['GET', '/api/admin/drivers'], ['GET', '/api/admin/rides'], ['GET', '/api/admin/reports']];

test('role x endpoint matrix: rider gets 403 on driver routes, driver gets 403 on rider routes', async () => {
  const b = await boot(); try {
    const rider = b.client(), driver = b.client(); await rider.login('rider'); await driver.login('driver');
    for (const [m, p] of DRIVER_ONLY) assert.equal((await rider.call(m, p, {})).s, 403, 'rider must not reach ' + p);
    for (const [m, p] of RIDER_ONLY) assert.equal((await driver.call(m, p, {})).s, 403, 'driver must not reach ' + p);
    assert.equal((await rider.call('GET', '/api/me')).j.role, 'rider'); assert.equal((await driver.call('GET', '/api/me')).j.role, 'driver');
  } finally { await b.stop(); } });

test('no session: every role-gated route is 401', async () => {
  const b = await boot(); try { const c = b.client();
    for (const [m, p] of [...DRIVER_ONLY, ...RIDER_ONLY, ['GET', '/api/me'], ['GET', '/api/rides/active']]) assert.equal((await c.call(m, p, {})).s, 401, p);
  } finally { await b.stop(); } });

test('existing account keeps its stored role: client-sent role on verify is ignored (both directions)', async () => {
  const b = await boot(); try {
    const a = b.client(); const ph = '0555800001'; const first = await a.verify(ph, 'rider'); assert.equal(first.j.user.role, 'rider');
    const again = b.client(); const r2 = await again.verify(ph, 'driver'); assert.equal(r2.j.user.role, 'rider', 'rider cannot become driver by picking driver at login');
    assert.equal((await again.call('GET', '/api/driver/me')).s, 403);
    const d = b.client(); const ph2 = '0666800002'; assert.equal((await d.verify(ph2, 'driver')).j.user.role, 'driver');
    const d2 = b.client(); assert.equal((await d2.verify(ph2, 'rider')).j.user.role, 'driver', 'driver cannot become rider');
    assert.equal((await d2.call('POST', '/api/requests', {})).s, 403);
  } finally { await b.stop(); } });

test('role cannot be set through profile endpoints or an unknown role value', async () => {
  const b = await boot(); try { const c = b.client(); await c.login('rider');
    await c.call('POST', '/api/me', { name: 'x', role: 'driver' }); assert.equal((await c.call('GET', '/api/me')).j.role, 'rider');
    const e = b.client(); const r = await e.verify('0555800009', 'admin'); assert.equal(r.j.user.role, 'rider', 'admin can never be self-selected');
  } finally { await b.stop(); } });

test('admin-role account: OTP session (sid) opens no rider/driver route and no admin route; /api/dev/role is the only mutator and is dev-only', async () => {
  const b = await boot(); try { const c = b.client(); const r = await c.verify('0550000000', 'rider'); assert.equal(r.j.user.role, 'admin');
    for (const [m, p] of [...DRIVER_ONLY, ...RIDER_ONLY]) assert.equal((await c.call(m, p, {})).s, 403, p);
    for (const [m, p] of ADMIN_ONLY) assert.equal((await c.call(m, p)).s, 401, 'sid must not unlock ' + p);
  } finally { await b.stop(); }
  const s = await boot({ dev: false, devAdmin: false }); try { const c = s.client(); await c.verify('0555800010', 'rider').catch(() => {}); assert.equal((await c.call('POST', '/api/dev/role', { role: 'driver' })).s, 404); } finally { await s.stop(); } });

test('a rider session cookie replayed as the admin cookie is rejected', async () => {
  const b = await boot(); try { const c = b.client(); await c.login('rider');
    const r = await fetch(b.base + '/api/admin/stats', { headers: { cookie: 'asid=' + c.jar.sid } }); assert.equal(r.status, 401);
  } finally { await b.stop(); } });

test('accepted fare stays immutable and a rider cannot bid on own request (negotiated-fare model intact)', async () => {
  const b = await boot(); try { const rider = b.client(), driver = b.client(); await rider.login('rider'); await driver.login('driver');
    const P = { lat: 36.75, lng: 3.05, label: 'A' }, D = { lat: 36.69, lng: 3.21, label: 'B' };
    await driver.call('POST', '/api/driver/profile', { car: 'Symbol', plate: 'R-1' }); await driver.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
    const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 450 });
    assert.equal((await rider.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 450, eta_min: 3 })).s, 403);
    const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 }); assert.equal(of.s, 200);
    const acc = await rider.call('POST', `/api/offers/${of.j.id}/accept`); assert.equal(acc.j.locked_price, 500);
    assert.equal((await rider.call('GET', `/api/rides/${acc.j.ride_id}`)).j.locked_price, 500);
    assert.equal(b.s.db.prepare('select locked_price p from rides').get().p, 500);
  } finally { await b.stop(); } });
