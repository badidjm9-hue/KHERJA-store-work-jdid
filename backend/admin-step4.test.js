// Step 4 admin API: authorization matrix, vehicle-change queue, passengers, audit, activity, stats, settings.
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
let n = 0; const P = { lat: 36.75, lng: 3.05, label: 'A' }, D = { lat: 36.69, lng: 3.21, label: 'B' };
async function boot() { const s = createApp({ dev: true, devAdmin: true }); await new Promise(r => s.listen(0, r)); const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {}; const c = async (m, p, b, hdr) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '), ...(hdr || {}) }, body: b ? JSON.stringify(b) : undefined });
    for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); } return { s: r.status, j: await r.json().catch(() => ({})) }; };
    c.jar = jar; c.login = async (role, name = 'U') => { const phone = '0555' + String(400000 + n++); await c('POST', '/api/auth/otp', { phone }); const r = await c('POST', '/api/auth/verify', { phone, code: '123456', role, name }); assert.equal(r.s, 200); return phone; }; return c; };
  const admin = async () => { const a = client(); assert.equal((await a('POST', '/api/admin/login', { phone: '0550000000', password: 'admin-dev-pass' })).s, 200); return a; };
  return { s, base, client, admin, close: () => new Promise(r => s.close(r)) }; }
async function lockedDriverWithChange(b, plate, np) { const d = b.client(); await d.login('driver', 'Karim'); await d('POST', '/api/driver/profile', { car: 'Symbol', plate }); b.s.db.prepare('update drivers set vehicle_locked=1 where plate=?').run(plate);
  const r = await d('POST', '/api/driver/profile', { car: 'Golf', plate: np, vehicle_type: 'car' }); assert.equal(r.j.change, 'pending'); return { d, id: r.j.request_id }; }

const GETS = ['/api/admin/stats', '/api/admin/drivers', '/api/admin/driver-changes', '/api/admin/driver-changes/1', '/api/admin/passengers', '/api/admin/passengers/1', '/api/admin/audit', '/api/admin/activity', '/api/admin/settings', '/api/admin/rides', '/api/admin/reports'];
test('authorization matrix: anonymous, rider, driver, and a user cookie replayed as the admin cookie are all refused; admin is accepted', async () => {
  const b = await boot(); const rider = b.client(), driver = b.client(); await rider.login('rider'); await driver.login('driver'); const adm = await b.admin(); await lockedDriverWithChange(b, 'AZ-1', 'AZ-2');
  const anon = b.client(); const replay = (who) => b.client().jar && (async (p, m = 'GET', body) => { const c = b.client(); c.jar.asid = who.jar.sid; return c(m, p, body); });
  for (const p of GETS) { assert.equal((await anon('GET', p)).s, 401, 'anon ' + p); assert.equal((await rider('GET', p)).s, 401, 'rider ' + p); assert.equal((await driver('GET', p)).s, 401, 'driver ' + p);
    assert.equal((await (await replay(rider))(p)).s, 401, 'rider sid replayed as asid ' + p); assert.equal((await (await replay(driver))(p)).s, 401, 'driver sid replayed as asid ' + p); assert.ok([200, 404].includes((await adm('GET', p)).s), 'admin ' + p); }
  for (const who of [anon, rider, driver]) { assert.equal((await who('POST', '/api/admin/driver-changes/1/decision', { decision: 'approved' })).s, 401); assert.equal((await who('POST', '/api/admin/drivers/1/suspend', { suspended: true, reason: 'x' })).s, 401); }
  assert.equal(b.s.db.prepare("select status from driver_change_requests").get().status, 'pending', 'no unauthorized decision took effect');
  assert.equal((await adm('GET', '/api/me')).s, 401, 'admin session is not a user session'); await b.close(); });
test('no public admin registration and no privilege escalation through user APIs', async () => {
  const b = await boot(); const u = b.client(); const phone = await u.login('rider');
  for (const [m, p, body] of [['POST', '/api/admin/register', { phone: '0555999999', password: 'x'.repeat(12) }], ['POST', '/api/admin/signup', {}], ['PUT', '/api/admin/users', {}]]) assert.ok([404, 405, 401].includes((await u(m, p, body)).s), p);
  for (const evil of [{ role: 'admin' }, { is_admin: true }, { admin: 1 }]) await u('POST', '/api/me', { name: 'x', ...evil }); assert.equal(b.s.db.prepare('select role from users where phone=?').get('+213' + phone.slice(1)).role, 'rider');
  const v = await b.client()('POST', '/api/auth/verify', { phone: '0555000123', code: '123456', role: 'admin' }); assert.ok(v.s >= 400, 'cannot pick the admin role at login'); assert.equal(b.s.db.prepare("select count(*) c from users where role='admin'").get().c, 1, 'exactly one admin (the configured one)');
  assert.equal((await b.client()('POST', '/api/admin/login', { phone: '0550000000', password: 'wrong' })).s, 401); await b.close(); });
test('vehicle-change queue: shape, filtering, history; the live vehicle only changes after approval', async () => {
  const b = await boot(); const adm = await b.admin(); const x = await lockedDriverWithChange(b, 'QA-1', 'QA-2'), y = await lockedDriverWithChange(b, 'QB-1', 'QB-2');
  assert.equal((await adm('GET', '/api/admin/driver-changes?status=bogus')).s, 400);
  let l = (await adm('GET', '/api/admin/driver-changes')).j.changes; assert.equal(l.length, 2); const c = l.find(r => r.id === x.id);
  assert.deepEqual(c.current, { vehicle_type: 'car', car: 'Symbol', plate: 'QA-1' }); assert.deepEqual(c.requested, { vehicle_type: 'car', car: 'Golf', plate: 'QA-2' }); assert.deepEqual(c.live, c.current, 'live vehicle untouched while pending');
  assert.equal(c.status, 'pending'); assert.ok(c.created_at && c.driver.name === 'Karim' && c.driver.phone); assert.ok(!JSON.stringify(c).match(/password|token|sid/i));
  assert.equal((await adm('POST', `/api/admin/driver-changes/${x.id}/decision`, { decision: 'approved' })).s, 200); assert.equal((await adm('POST', `/api/admin/driver-changes/${x.id}/decision`, { decision: 'approved' })).s, 409, 'duplicate approve');
  assert.equal((await adm('POST', `/api/admin/driver-changes/${x.id}/decision`, { decision: 'rejected', reason: 'late' })).s, 409, 'conflicting second decision');
  assert.equal((await adm('POST', `/api/admin/driver-changes/${y.id}/decision`, { decision: 'rejected', reason: 'unclear photo' })).s, 200);
  assert.equal(b.s.db.prepare("select plate from drivers where plate in('QA-2','QA-1')").all().map(r => r.plate).join(), 'QA-2'); assert.equal(b.s.db.prepare("select count(*) c from drivers where plate='QB-2'").get().c, 0, 'rejected: live vehicle never changed');
  assert.deepEqual((await adm('GET', '/api/admin/driver-changes')).j.changes, [], 'pending queue now empty'); const all = (await adm('GET', '/api/admin/driver-changes?status=all')).j.changes; assert.deepEqual(all.map(r => r.status).sort(), ['approved', 'rejected']);
  assert.equal(all.find(r => r.id === y.id).reason, 'unclear photo'); const det = (await adm('GET', `/api/admin/driver-changes/${x.id}`)).j; assert.deepEqual(det.history.map(h => h.action), ['approved', 'requested']); assert.equal(det.history[0].actor_role, 'admin'); assert.ok(det.history[0].actor_name);
  assert.equal((await adm('GET', '/api/admin/driver-changes/99999')).s, 404); assert.equal((await adm('GET', '/api/admin/driver-changes?status=rejected')).j.changes.length, 1); await b.close(); });
test('passengers: search is wildcard-safe, detail is audited, drivers are not passengers', async () => {
  const b = await boot(); const adm = await b.admin(); const r = b.client(); await r.login('rider', '100%_sure'); const r2 = b.client(); await r2.login('rider', 'Plain'); const d = b.client(); await d.login('driver', 'Drv');
  const names = async q => (await adm('GET', '/api/admin/passengers?q=' + encodeURIComponent(q))).j.passengers.map(p => p.name).sort();
  assert.deepEqual(await names(''), ['100%_sure', 'Plain']); assert.deepEqual(await names('%'), ['100%_sure'], 'literal % only'); assert.deepEqual(await names('_'), ['100%_sure']); assert.deepEqual(await names("' or 1=1 --"), []);
  const id = (await adm('GET', '/api/admin/passengers?q=Plain')).j.passengers[0].id; const det = await adm('GET', `/api/admin/passengers/${id}`); assert.equal(det.s, 200); assert.deepEqual(det.j.rides, []);
  assert.deepEqual(b.s.db.prepare("select action,target from audit where action='view_passenger'").all().map(x => ({ ...x })), [{ action: 'view_passenger', target: 'user:' + id }]);
  assert.equal((await adm('GET', `/api/admin/passengers/${b.s.db.prepare("select id from users where role='driver'").get().id}`)).s, 404); await b.close(); });
test('audit log, activity feed, extended stats and read-only settings expose only real data and no secrets', async () => {
  const b = await boot(); const adm = await b.admin(); const x = await lockedDriverWithChange(b, 'AU-1', 'AU-2'); await adm('POST', `/api/admin/driver-changes/${x.id}/decision`, { decision: 'approved' });
  const au = (await adm('GET', '/api/admin/audit')).j.entries; assert.equal(au[0].action, 'driver_change_approved'); assert.ok(au[0].admin_name || au[0].created_at); assert.equal((await adm('GET', '/api/admin/audit?action=nothing')).j.entries.length, 0); assert.equal((await adm('GET', '/api/admin/audit?limit=-5')).s, 200);
  const act = (await adm('GET', '/api/admin/activity')).j.items; assert.ok(act.some(i => i.type === 'vehicle_change' && i.status === 'approved') && act.some(i => i.type === 'audit')); assert.ok(act.length <= 15);
  const st = (await adm('GET', '/api/admin/stats')).j; for (const k of ['riders', 'drivers', 'drivers_approved', 'drivers_pending', 'drivers_suspended', 'pending_changes', 'rides_active', 'rides_completed', 'rides_cancelled', 'rides_total', 'fares_completed_dzd']) assert.equal(typeof st[k], 'number', k);
  assert.ok(Array.isArray(st.rides_by_day)); assert.equal(st.pending_changes, 0); assert.ok(!('revenue' in st), 'no invented revenue figure');
  const se = (await adm('GET', '/api/admin/settings')).j; assert.deepEqual(Object.keys(se).sort(), ['counteroffer_max_ratio', 'environment', 'offer_ttl_ms', 'otp_mode', 'require_driver_approval']); assert.equal(se.offer_ttl_ms, 15000); assert.ok(!JSON.stringify(se).match(/pass|secret|token|key|hash/i)); await b.close(); });
