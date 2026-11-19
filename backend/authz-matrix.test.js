// Regression: cross-user access (IDOR), unauthenticated access, and role isolation on ride/notification/earnings/contacts/report endpoints.
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
let n = 0;
async function boot() {
  const s = createApp({ dev: true, devAdmin: true }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {}; const ck = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: ck() }, body: b && m !== 'GET' ? JSON.stringify(b) : undefined });
      for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); }
      return { s: r.status, j: r.headers.get('content-type')?.includes('json') ? await r.json() : {} }; };
    return { call, login: async role => { const phone = '0555' + String(900000 + n++); await call('POST', '/api/auth/otp', { phone }); return call('POST', '/api/auth/verify', { phone, code: '123456', role, name: 'T' }); } }; };
  return { client, stop: () => new Promise(r => s.close(r)) };
}
test('IDOR: a third user cannot read, report, rate, change status, or learn about another pair\'s ride', async () => {
  const b = await boot(); try {
    const rider = b.client(), drv = b.client(), other = b.client(), otherDrv = b.client(); await rider.login('rider'); await drv.login('driver'); await other.login('rider'); await otherDrv.login('driver');
    await drv.call('POST', '/api/driver/profile', { car: 'Dacia', plate: '77-111-16' }); await drv.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
    const rq = await rider.call('POST', '/api/requests', { pickup: { lat: 36.75, lng: 3.05, label: 'A' }, dropoff: { lat: 36.69, lng: 3.21, label: 'B' }, price: 450 });
    const of = await drv.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 }); const ac = await rider.call('POST', `/api/offers/${of.j.id}/accept`); const id = ac.j.ride_id;
    for (const c of [other, otherDrv]) {
      assert.equal((await c.call('GET', `/api/rides/${id}`)).s, 404); assert.equal((await c.call('POST', `/api/rides/${id}/report`, { kind: 'other' })).s, 404);
      assert.equal((await c.call('POST', `/api/rides/${id}/rating`, { stars: 1 })).s, 404); assert.equal((await c.call('POST', `/api/rides/${id}/status`, { status: 'cancelled' })).s, 404);
      assert.equal((await c.call('GET', '/api/rides')).j.rides.length, 0); }
    assert.equal((await other.call('POST', `/api/offers/${of.j.id}/accept`)).s >= 400, true); // not the request owner
    assert.equal((await rider.call('POST', `/api/rides/${id}/status`, { status: 'arrived' })).s, 403); // rider cannot drive the ride forward
    assert.equal((await drv.call('GET', `/api/rides/${id}`)).s, 200);
    assert.equal((await rider.call('GET', `/api/rides/${id}`)).j.locked_price ?? 500, 500);
  } finally { await b.stop(); } });
test('every new/extra endpoint refuses unauthenticated callers; admin API refuses rider and driver sessions', async () => {
  const b = await boot(); try {
    const anon = b.client(); for (const [m, p] of [['GET', '/api/notifications'], ['POST', '/api/notifications/read'], ['GET', '/api/driver/earnings'], ['GET', '/api/safety/contacts'], ['POST', '/api/safety/contacts'], ['GET', '/api/rides'], ['DELETE', '/api/me'], ['GET', '/api/admin/stats']])
      assert.equal((await anon.call(m, p, {})).s, 401, m + ' ' + p);
    const rider = b.client(), drv = b.client(); await rider.login('rider'); await drv.login('driver');
    for (const c of [rider, drv]) for (const p of ['/api/admin/stats', '/api/admin/drivers', '/api/admin/rides', '/api/admin/reports', '/api/admin/passengers', '/api/admin/audit']) assert.ok([401, 403].includes((await c.call('GET', p)).s), p);
    assert.ok([401, 403].includes((await rider.call('POST', '/api/admin/reports/1', { status: 'closed' })).s));
  } finally { await b.stop(); } });
test('account deletion invalidates the session and frees nothing for others (other users keep their data)', async () => {
  const b = await boot(); try {
    const a = b.client(), c = b.client(); await a.login('rider'); await c.login('rider'); await c.call('POST', '/api/safety/contacts', { name: 'X', phone: '0787654321' });
    assert.equal((await a.call('DELETE', '/api/me')).s, 200); assert.equal((await a.call('GET', '/api/me')).s, 401);
    assert.equal((await c.call('GET', '/api/safety/contacts')).j.contacts.length, 1);
  } finally { await b.stop(); } });
