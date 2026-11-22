const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
let n = 0;
async function boot(opts) {
  const s = createApp({ dev: true, devAdmin: true, ...opts }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {}; const cookie = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: cookie() }, body: b ? JSON.stringify(b) : undefined });
      for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); } return { s: r.status, j: r.headers.get('content-type')?.includes('json') ? await r.json() : {}, sc: null }; };
    return { call, cookie, login: async (role, name) => { const phone = '0555' + String(100000 + n++); await call('POST', '/api/auth/otp', { phone }); const r = await call('POST', '/api/auth/verify', { phone, code: '123456', role, name }); assert.equal(r.s, 200); return r; } }; };
  return { s, client, base };
}
const P = { lat: 36.75, lng: 3.05, label: 'A' }, D = { lat: 36.69, lng: 3.21, label: 'B' };
async function setup(b) {
  const rider = b.client(), driver = b.client(); await rider.login('rider', 'Amine'); await driver.login('driver', 'Karim');
  await driver.call('POST', '/api/driver/profile', { car: 'Symbol', plate: '04721-116-16' }); await driver.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
  return { rider, driver };
}

test('full ride flow with locked price', async () => {
  const b = await boot(); const { rider, driver } = await setup(b);
  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 450 }); assert.equal(rq.s, 200);
  const feed = await driver.call('GET', '/api/driver/requests'); assert.equal(feed.j.requests.length, 1);
  const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 4 }); assert.equal(of.s, 200);
  const list = await rider.call('GET', `/api/requests/${rq.j.id}/offers`); assert.equal(list.j.offers[0].price, 500); assert.equal(list.j.offers[0].driver.cancel_pct, 0);
  const acc = await rider.call('POST', `/api/offers/${of.j.id}/accept`); assert.equal(acc.j.locked_price, 500);
  const rid = acc.j.ride_id;
  assert.equal((await driver.call('POST', `/api/rides/${rid}/status`, { status: 'in_progress' })).s, 409, 'skip step refused');
  for (const st of ['arrived', 'in_progress', 'completed']) assert.equal((await driver.call('POST', `/api/rides/${rid}/status`, { status: st })).s, 200);
  assert.equal((await driver.call('POST', `/api/rides/${rid}/status`, { status: 'completed' })).s, 200, 'idempotent');
  assert.equal((await rider.call('POST', `/api/rides/${rid}/rating`, { stars: 5, tags: ['x'] })).s, 200);
  assert.equal((await rider.call('POST', `/api/rides/${rid}/rating`, { stars: 4 })).s, 409, 'double rating');
  assert.throws(() => b.s.db.prepare('update rides set locked_price=1 where id=?').run(rid), /immutable/);
  assert.equal((await rider.call('GET', '/api/rides')).j.rides[0].locked_price, 500);
  b.s.close();
});

test('personal data export is authenticated and scoped to current user', async () => {
  const b = await boot(); const { rider } = await setup(b); const anon = b.client();
  assert.equal((await anon.call('GET', '/api/me/export')).s, 401);
  const exportData = await rider.call('GET', '/api/me/export');
  assert.equal(exportData.s, 200); assert.equal(exportData.j.export_version, 1);
  assert.equal(exportData.j.account.name, 'Amine'); assert.equal(Boolean(exportData.j.account.phone), true);
  assert.deepEqual(exportData.j.rides, []); assert.deepEqual(exportData.j.safety_contacts, []);
  assert.ok(exportData.j.exported_at); assert.equal(Object.hasOwn(exportData.j, 'password_hash'), false);
  b.s.close();
});

test('second user cannot read or act on others data', async () => {
  const b = await boot(); const { rider, driver } = await setup(b); const other = b.client(); await other.login('rider', 'Eve');
  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 450 });
  const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 450, eta_min: 3 });
  assert.equal((await other.call('GET', `/api/requests/${rq.j.id}/offers`)).s, 404);
  assert.equal((await other.call('POST', `/api/offers/${of.j.id}/accept`)).s, 404);
  assert.equal((await other.call('POST', `/api/requests/${rq.j.id}/cancel`)).s, 404);
  const acc = await rider.call('POST', `/api/offers/${of.j.id}/accept`);
  assert.equal((await other.call('POST', `/api/rides/${acc.j.ride_id}/status`, { status: 'arrived' })).s, 404);
  assert.equal((await other.call('POST', `/api/rides/${acc.j.ride_id}/report`, { kind: 'safety' })).s, 404);
  assert.equal((await rider.call('POST', `/api/rides/${acc.j.ride_id}/status`, { status: 'arrived' })).s, 403, 'rider cannot drive');
  assert.equal((await other.call('GET', '/api/rides')).j.rides.length, 0);
  assert.equal((await b.client().call('GET', '/api/me')).s, 401);
  b.s.close();
});

test('validation and abuse rules', async () => {
  const b = await boot(); const { rider, driver } = await setup(b);
  assert.equal((await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: -5 })).s, 400);
  assert.equal((await rider.call('POST', '/api/requests', { pickup: { lat: 999, lng: 0, label: 'x' }, dropoff: D, price: 300 })).s, 400);
  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400 });
  assert.equal((await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400 })).s, 409, 'one open request');
  assert.equal((await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 900, eta_min: 3 })).s, 400, 'gouging refused');
  assert.equal((await rider.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 })).s, 403, 'rider cannot bid');
  assert.equal((await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 })).s, 200);
  assert.equal((await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 })).s, 409, 'one bid per driver');
  const far = b.client(); await far.login('driver', 'Far'); await far.call('POST', '/api/driver/profile', { car: 'X', plate: 'FAR-1' }); await far.call('POST', '/api/driver/online', { online: true, lat: 35.0, lng: 1.0 });
  assert.equal((await far.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 })).s, 403, 'too far');
  b.s.close();
});

test('women-only requests, otp rate limit, delete account', async () => {
  const b = await boot(); const { rider, driver } = await setup(b);
  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400, women_only: true });
  assert.equal((await driver.call('GET', '/api/driver/requests')).j.requests.length, 0);
  assert.equal((await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 })).s, 403);
  const c = b.client(); const r = [];
  for (let i = 0; i < 4; i++) r.push((await c.call('POST', '/api/auth/otp', { phone: '0777000111' })).s);
  assert.deepEqual(r, [200, 200, 200, 429]);
  assert.equal((await c.call('POST', '/api/auth/verify', { phone: '0777000111', code: '000000' })).s, 400);
  const me = await rider.call('DELETE', '/api/me'); assert.equal(me.s, 200);
  assert.equal((await rider.call('GET', '/api/me')).s, 401);
  b.s.close();
});

test('waitlist validates, dedupes, rate limits', async () => {
  const b = await boot(); const c = b.client();
  assert.equal((await c.call('POST', '/api/waitlist', { phone: '0555999111', role: 'rider' })).s, 200);
  assert.equal((await c.call('POST', '/api/waitlist', { phone: '0555999111', role: 'driver' })).s, 200);
  assert.equal(b.s.db.prepare('select count(*) c from waitlist').get().c, 1);
  assert.equal((await c.call('POST', '/api/waitlist', { phone: '123', role: 'rider' })).s, 400);
  assert.equal((await c.call('POST', '/api/waitlist', { phone: '0555999111', role: 'admin' })).s, 400);
  b.s.close();
});

test('delivery request: item fields, negotiation, contact phones only after accept', async () => {
  const b = await boot(); const { rider, driver } = await setup(b);
  assert.equal((await rider.call('POST', '/api/requests', { kind: 'delivery', pickup: P, dropoff: D, price: 300 })).s, 400, 'item_type required');
  assert.equal((await rider.call('POST', '/api/requests', { kind: 'delivery', item_type: 'weapons', item_note: 'x', pickup: P, dropoff: D, price: 300 })).s, 400);
  const rq = await rider.call('POST', '/api/requests', { kind: 'delivery', item_type: 'food', item_note: 'بيتزا كبيرة', recipient_name: 'Sara', recipient_phone: '0661000222', pickup: P, dropoff: D, price: 300 });
  assert.equal(rq.s, 200);
  const feed = (await driver.call('GET', '/api/driver/requests')).j.requests[0];
  assert.equal(feed.kind, 'delivery'); assert.equal(feed.item_type, 'food'); assert.ok(!JSON.stringify(feed).includes('0661000222'), 'recipient phone hidden before accept');
  const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 350, eta_min: 6 });
  const offers = await rider.call('GET', `/api/requests/${rq.j.id}/offers`); assert.ok(!JSON.stringify(offers.j).match(/\+213/), 'no phones in offers');
  const acc = await rider.call('POST', `/api/offers/${of.j.id}/accept`);
  const rv = await rider.call('GET', `/api/rides/${acc.j.ride_id}`); assert.equal(rv.j.kind, 'delivery'); assert.match(rv.j.contact.phone, /^\+213/); assert.equal(rv.j.recipient, undefined);
  const dv = await driver.call('GET', `/api/rides/${acc.j.ride_id}`); assert.equal(dv.j.recipient.phone, '+213661000222'); assert.equal(dv.j.recipient.name, 'Sara'); assert.match(dv.j.contact.phone, /^\+213/);
  const other = b.client(); await other.login('rider', 'Eve'); assert.equal((await other.call('GET', `/api/rides/${acc.j.ride_id}`)).s, 404);
  const act = await driver.call('GET', '/api/rides/active'); assert.equal(act.j.ride.item_note, 'بيتزا كبيرة');
  b.s.close();
});

test('delivery: validation, contacts only after accept, only to the two parties, hidden after the ride', async () => {
  const b = await boot(); const { rider, driver } = await setup(b); const other = b.client(); await other.login('rider', 'Eve');
  const base = { kind: 'delivery', pickup: P, dropoff: D, price: 300, item_type: 'food', item_note: 'sandwich bag', recipient_name: 'Sara', recipient_phone: '0661000222' };
  for (const bad of [{ item_type: 'gun' }, { item_note: '' }, { recipient_phone: '123' }, { price: 0 }])
    assert.equal((await rider.call('POST', '/api/requests', { ...base, ...bad })).s, 400, JSON.stringify(bad));
  const rq = await rider.call('POST', '/api/requests', base); assert.equal(rq.s, 200);
  const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 300, eta_min: 5 }); assert.equal(of.s, 200);
  const feed = (await driver.call('GET', '/api/driver/requests')).j.requests[0];
  assert.equal(feed.kind, 'delivery'); assert.equal(feed.item_type, 'food'); assert.equal(JSON.stringify(feed).includes('0661000222'), false, 'recipient phone not in feed');
  const offers = (await rider.call('GET', `/api/requests/${rq.j.id}/offers`)).j; assert.equal(JSON.stringify(offers).includes('+213555'), false, 'driver phone not in offers');
  const acc = await rider.call('POST', `/api/offers/${of.j.id}/accept`); const rid = acc.j.ride_id;
  const asDriver = (await driver.call('GET', `/api/rides/${rid}`)).j, asRider = (await rider.call('GET', `/api/rides/${rid}`)).j;
  assert.equal(asDriver.contact.name, 'Amine'); assert.match(asDriver.contact.phone, /^\+213555/); assert.equal(asDriver.recipient.name, 'Sara'); assert.equal(asDriver.recipient.phone, '+213661000222');
  assert.match(asRider.contact.phone, /^\+213/); assert.equal(asRider.recipient, undefined, 'sender view has no recipient block');
  assert.equal((await other.call('GET', `/api/rides/${rid}`)).s, 404);
  for (const st of ['arrived', 'in_progress', 'completed']) await driver.call('POST', `/api/rides/${rid}/status`, { status: st });
  for (const c of [rider, driver]) { const d = (await c.call('GET', `/api/rides/${rid}`)).j; assert.equal(d.contact, undefined, 'contact hidden after completion'); assert.equal(d.recipient, undefined); }
  b.s.close();
});

const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]).toString('base64');

test('driver onboarding: docs upload rules, admin review, gating, privacy', async () => {
  const b = await boot({ requireApproval: true }); const driver = b.client(), other = b.client(), adm = b.client();
  await driver.login('driver', 'Karim'); await other.login('driver', 'Omar');
  assert.equal((await driver.call('GET', '/api/driver/me')).j.profile, null);
  assert.equal((await driver.call('POST', '/api/driver/docs', { kind: 'license', data: jpg() })).s, 400, 'profile first');
  assert.equal((await driver.call('POST', '/api/driver/profile', { vehicle_type: 'moto', car: 'Yamaha NMAX', plate: '12345-116-16', name: 'Karim B' })).s, 200);
  assert.equal((await other.call('POST', '/api/driver/profile', { car: 'Symbol', plate: '12345-116-16' })).s, 409, 'plate unique');
  await other.call('POST', '/api/driver/profile', { car: 'Symbol', plate: '99999-116-16' });
  assert.equal((await driver.call('POST', '/api/driver/online', { online: true, lat: 36.7, lng: 3.0 })).s, 403, 'not approved');
  const bad = [{ kind: 'passport', data: jpg() }, { kind: 'license', data: Buffer.from('hello world '.repeat(40)).toString('base64') }, { kind: 'license', data: 'AAAA' }, { kind: 'license', data: jpg(), expires_on: 'tomorrow' }];
  for (const x of bad) assert.equal((await driver.call('POST', '/api/driver/docs', x)).s, 400, JSON.stringify(x).slice(0, 40));
  const ids = {}; for (const k of ['vehicle_photo', 'license', 'registration', 'insurance']) { const r = await driver.call('POST', '/api/driver/docs', { kind: k, data: jpg(), expires_on: k === 'insurance' ? '2027-01-31' : undefined }); assert.equal(r.s, 200); ids[k] = r.j.id; }
  const me = (await driver.call('GET', '/api/driver/me')).j; assert.equal(me.docs.length, 4); assert.equal(me.profile.docs_status, 'pending'); assert.equal(me.can_go_online, false); assert.equal(me.profile.vehicle_type, 'moto');
  assert.equal((await other.call('GET', `/api/driver/docs/${ids.license}/file`)).s, 404, 'other driver cannot see my document');
  assert.equal((await driver.call('GET', '/api/admin/drivers')).s, 401, 'no admin access without admin login');
  assert.equal((await adm.call('POST', '/api/admin/login', { phone: '0550000000', password: 'wrong' })).s, 401);
  assert.equal((await adm.call('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' })).s, 200);
  const list = (await adm.call('GET', '/api/admin/drivers?status=pending')).j.drivers; assert.equal(list.length, 1); assert.equal(list[0].name, 'Karim B'); assert.equal((await adm.call('GET', '/api/admin/stats')).j.drivers_pending, 1);
  const det = (await adm.call('GET', `/api/admin/drivers/${list[0].id}`)).j; assert.equal(det.docs.length, 4);
  const raw = await fetch(b.base + `/api/admin/docs/${ids.license}/file`, { headers: { cookie: adm.cookie() } }); assert.equal(raw.status, 200); assert.equal(raw.headers.get('content-type'), 'image/jpeg'); assert.equal(raw.headers.get('x-content-type-options'), 'nosniff'); assert.equal((await raw.arrayBuffer()).byteLength, 404);
  assert.equal((await adm.call('POST', `/api/admin/docs/${ids.insurance}/review`, { status: 'rejected' })).s, 400, 'reason required');
  assert.equal((await adm.call('POST', `/api/admin/docs/${ids.insurance}/review`, { status: 'rejected', reason: 'expired' })).j.docs_status, 'rejected');
  for (const k of ['vehicle_photo', 'license', 'registration']) await adm.call('POST', `/api/admin/docs/${ids[k]}/review`, { status: 'approved' });
  const me2 = (await driver.call('GET', '/api/driver/me')).j; assert.equal(me2.docs.find(d => d.kind === 'insurance').reason, 'expired'); assert.equal(me2.can_go_online, false);
  const re = await driver.call('POST', '/api/driver/docs', { kind: 'insurance', data: jpg() }); assert.equal((await driver.call('GET', '/api/driver/me')).j.docs.length, 4, 'replaced, not duplicated'); assert.equal((await driver.call('GET', '/api/driver/me')).j.profile.docs_status, 'pending');
  assert.equal((await adm.call('POST', `/api/admin/docs/${re.j.id}/review`, { status: 'approved' })).j.docs_status, 'approved');
  assert.equal((await driver.call('POST', '/api/driver/online', { online: true, lat: 36.7, lng: 3.0 })).s, 200, 'approved driver goes online');
  assert.equal((await adm.call('POST', `/api/admin/drivers/${list[0].id}/suspend`, { suspended: true, reason: 'complaints' })).j.suspended, true);
  assert.equal((await driver.call('POST', '/api/driver/online', { online: true, lat: 36.7, lng: 3.0 })).s, 403, 'suspended');
  assert.equal(b.s.db.prepare("select count(*) c from audit where action<>'view_doc'").get().c, 6);
  assert.deepEqual(b.s.db.prepare("select action,target from audit where action='view_doc'").all().map(r => ({ ...r })), [{ action: 'view_doc', target: `doc:${ids.license} user:${b.s.db.prepare('select user_id u from driver_docs where id=?').get(ids.license).u}` }], 'the single admin document view is audited with doc and owner');
  assert.equal((await adm.call('POST', '/api/admin/logout')).s, 200); assert.equal((await adm.call('GET', '/api/admin/me')).s, 401);
  const wl = await fetch(b.base + '/api/waitlist', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }); assert.equal(wl.status, 415, 'json content-type required');
  b.s.close();
});

test('admin lists rides and reports; rider cannot reach admin', async () => {
  const b = await boot(); const { rider, driver } = await setup(b); const adm = b.client();
  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400 }); const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 });
  const acc = await rider.call('POST', `/api/offers/${of.j.id}/accept`); await rider.call('POST', `/api/rides/${acc.j.ride_id}/report`, { kind: 'price_dispute', body: 'asked more' });
  assert.equal((await rider.call('GET', '/api/admin/rides')).s, 401);
  await adm.call('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' });
  const l = (await adm.call('GET', '/api/admin/rides')).j.rides; assert.equal(l.length, 1); assert.equal(l[0].rider_name, 'Amine'); assert.equal((await adm.call('GET', '/api/admin/rides?status=completed')).j.rides.length, 0);
  assert.equal((await adm.call('GET', '/api/admin/rides?q=Amine')).j.rides.length, 1); assert.equal((await adm.call('GET', '/api/admin/rides?q=nobody')).j.rides.length, 0);
  const det = (await adm.call('GET', `/api/admin/rides/${acc.j.ride_id}`)).j; assert.equal(det.ride.locked_price, 400); assert.equal(det.reports.length, 1);
  const rep = (await adm.call('GET', '/api/admin/reports')).j.reports; assert.equal(rep[0].kind, 'price_dispute'); assert.equal((await adm.call('POST', `/api/admin/reports/${rep[0].id}`, { status: 'closed' })).s, 200);
  assert.equal((await adm.call('GET', '/api/admin/stats')).j.reports_open, 0);
  b.s.close();
});


test('ride vehicle type is enforced in driver feed and offer creation', async () => {
  const b = await boot();
  const rider = b.client(), carDriver = b.client(), motoDriver = b.client();
  await rider.login('rider', 'Nour');
  await carDriver.login('driver', 'Car driver');
  await carDriver.call('POST', '/api/driver/profile', { car: 'Symbol', plate: 'CAR-116-16', vehicle_type: 'car' });
  await carDriver.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
  await motoDriver.login('driver', 'Moto driver');
  await motoDriver.call('POST', '/api/driver/profile', { car: 'Scooter', plate: 'MOTO-116-16', vehicle_type: 'moto' });
  await motoDriver.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });

  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 450, vehicle_type: 'moto' });
  assert.equal(rq.s, 200);
  assert.equal((await carDriver.call('GET', '/api/driver/requests')).j.requests.length, 0, 'car driver must not see moto ride');
  assert.equal((await motoDriver.call('GET', '/api/driver/requests')).j.requests.length, 1, 'moto driver sees moto ride');
  assert.equal((await carDriver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 450, eta_min: 3 })).s, 403, 'server rejects wrong vehicle even if request id is known');
  assert.equal((await motoDriver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 450, eta_min: 3 })).s, 200);
  assert.equal((await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 450, vehicle_type: 'truck' })).s, 400, 'unknown vehicle type rejected');
  b.s.close();
});

test('server fare quote endpoint and minimum fare enforcement', async () => {
  const b = await boot(); const anonymous = b.client();
  assert.equal((await anonymous.call('POST', '/api/fare/quote', { pickup: P, dropoff: D, vehicle_type: 'car' })).s, 401);
  const rider = b.client(); await rider.login('rider', 'Fare');
  const q = await rider.call('POST', '/api/fare/quote', { pickup: P, dropoff: D, vehicle_type: 'car' });
  assert.equal(q.s, 200); assert.ok(q.j.suggested_fare_dzd >= 350); assert.equal(q.j.vehicle, 'car');
  const moto = await rider.call('POST', '/api/fare/quote', { pickup: P, dropoff: D, vehicle_type: 'moto' });
  assert.equal(moto.s, 200); assert.equal(moto.j.vehicle, 'moto'); assert.ok(moto.j.suggested_fare_dzd >= 350);
  assert.equal((await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 349, vehicle_type: 'car' })).s, 400);
  assert.equal((await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 350, vehicle_type: 'car' })).s, 200);
  b.s.close();
});


test('expired parent request expires its offers and cannot be accepted', async () => {
  const b = await boot(); const { rider, driver } = await setup(b);
  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400 });
  const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 });
  assert.equal(of.s, 200);
  b.s.db.prepare('update requests set expires_at=? where id=?').run(Date.now() - 1, rq.j.id);
  assert.equal((await rider.call('GET', `/api/requests/${rq.j.id}/offers`)).j.offers.length, 0);
  assert.equal(b.s.db.prepare('select status from requests where id=?').get(rq.j.id).status, 'expired');
  assert.equal(b.s.db.prepare('select status from offers where id=?').get(of.j.id).status, 'expired');
  assert.equal((await rider.call('POST', `/api/offers/${of.j.id}/accept`)).s, 409);
  b.s.close();
});

test('cancelling a request atomically declines pending offers', async () => {
  const b = await boot(); const { rider, driver } = await setup(b);
  const rq = await rider.call('POST', '/api/requests', { pickup: P, dropoff: D, price: 400 });
  const of = await driver.call('POST', `/api/requests/${rq.j.id}/offers`, { price: 400, eta_min: 3 });
  assert.equal(of.s, 200);
  assert.equal((await rider.call('POST', `/api/requests/${rq.j.id}/cancel`)).s, 200);
  assert.equal(b.s.db.prepare('select status from requests where id=?').get(rq.j.id).status, 'cancelled');
  assert.equal(b.s.db.prepare('select status from offers where id=?').get(of.j.id).status, 'declined');
  assert.equal((await rider.call('POST', `/api/offers/${of.j.id}/accept`)).s, 409);
  b.s.close();
});
