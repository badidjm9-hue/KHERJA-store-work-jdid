// Real-backend tests: in-app notifications (written only by real events), earnings, account deletion cascade, isolation.
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
let n = 0;
async function boot() {
  const s = createApp({ dev: true, devAdmin: true }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {}; const ck = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: ck() }, body: b && m !== 'GET' ? JSON.stringify(b) : undefined });
      for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); }
      return { s: r.status, j: r.headers.get('content-type')?.includes('json') ? await r.json() : {} }; };
    const login = async role => { const phone = '0555' + String(800000 + n++); await call('POST', '/api/auth/otp', { phone }); return call('POST', '/api/auth/verify', { phone, code: '123456', role, name: 'T' }); };
    return { call, login }; };
  return { client, stop: () => new Promise(r => s.close(r)) };
}
async function ride(b) {
  const rider = b.client(), drv = b.client(); await rider.login('rider'); await drv.login('driver');
  await drv.call('POST', '/api/driver/profile', { car: 'Dacia Logan', plate: String(n++) + '-111-16' }); await drv.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
  const rq = await rider.call('POST', '/api/requests', { pickup: { lat: 36.75, lng: 3.05, label: 'A' }, dropoff: { lat: 36.69, lng: 3.21, label: 'B' }, price: 450 });
  const of = await drv.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 });
  const ac = await rider.call('POST', `/api/offers/${of.j.id}/accept`); return { rider, drv, rq, of, ac };
}
test('notifications: real events create them, only for the right user, read state persists, no fake ones', async () => {
  const b = await boot(); try {
    const rider = b.client(); await rider.login('rider'); assert.deepEqual((await rider.call('GET', '/api/notifications')).j, { notifications: [], unread: 0 });
    const { rider: r, drv, ac } = await ride(b); assert.equal(ac.s, 200);
    const rn = (await r.call('GET', '/api/notifications')).j, dn = (await drv.call('GET', '/api/notifications')).j;
    assert.deepEqual(rn.notifications.map(x => x.kind), ['new_offer']); assert.deepEqual(dn.notifications.map(x => x.kind), ['offer_accepted']);
    await drv.call('POST', `/api/rides/${ac.j.ride_id}/status`, { status: 'arrived' });
    const rn2 = (await r.call('GET', '/api/notifications')).j; assert.equal(rn2.unread, 2); assert.equal(rn2.notifications[0].kind, 'ride_status'); assert.equal(rn2.notifications[0].detail, 'arrived');
    // another user never sees them; cannot mark others' as read
    assert.equal((await rider.call('GET', '/api/notifications')).j.notifications.length, 0);
    await rider.call('POST', '/api/notifications/read', { id: rn2.notifications[0].id }); assert.equal((await r.call('GET', '/api/notifications')).j.unread, 2);
    await r.call('POST', '/api/notifications/read', { id: rn2.notifications[0].id }); assert.equal((await r.call('GET', '/api/notifications')).j.unread, 1);
    await r.call('POST', '/api/notifications/read', {}); assert.equal((await r.call('GET', '/api/notifications')).j.unread, 0);
    assert.equal((await r.call('POST', '/api/notifications/read', { id: 'x' })).s, 400);
    assert.equal((await b.client().call('GET', '/api/notifications')).s, 401);
  } finally { await b.stop(); } });
test('driver earnings: only completed rides, gross, honest flags, driver-only', async () => {
  const b = await boot(); try {
    const { rider, drv, ac } = await ride(b);
    assert.equal((await drv.call('GET', '/api/driver/earnings')).j.all.n, 0);
    for (const s of ['arrived', 'in_progress', 'completed']) await drv.call('POST', `/api/rides/${ac.j.ride_id}/status`, { status: s });
    const e = (await drv.call('GET', '/api/driver/earnings')).j; assert.equal(e.all.n, 1); assert.equal(e.all.total, 500); assert.equal(e.commission_applied, false); assert.equal(e.gross, true);
    assert.equal((await rider.call('GET', '/api/driver/earnings')).s, 403);
  } finally { await b.stop(); } });
test('account deletion removes the user and their notifications', async () => {
  const b = await boot(); try {
    const { rider, drv } = await ride(b); assert.equal((await rider.call('DELETE', '/api/me')).s, 200);
    assert.equal((await rider.call('GET', '/api/notifications')).s, 401);
    const dn = (await drv.call('GET', '/api/notifications')).j; assert.ok(Array.isArray(dn.notifications));
  } finally { await b.stop(); } });
