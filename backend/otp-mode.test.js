// Phase 2.1 / F-3: OTP behaviour per mode. Secure mode never reveals or pretends; dev mode keeps the explicit demo code.
// Run: node --test backend/otp-mode.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
const boot = async opts => { const s = createApp(opts); await new Promise(r => s.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + s.address().port;
  const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null), raw: r }; };
  return { s, post, otps: () => s.db.prepare('select count(*) c from otps').get().c, stop: () => new Promise(r => s.close(r)) }; };

test('secure mode, no SMS sender: 503 sms_unavailable, nothing stored, nothing claims a message was sent', async () => {
  const b = await boot({ dev: false }); try { const r = await b.post('/api/auth/otp', { phone: '0555830001' });
    assert.equal(r.s, 503); assert.deepEqual(r.j, { error: 'sms_unavailable' }); assert.equal(b.otps(), 0, 'no OTP row is created');
    assert.equal((await b.post('/api/auth/verify', { phone: '0555830001', code: '123456' })).s, 400);
    assert.equal((await b.post('/api/auth/otp', { phone: 'bad' })).s, 400, 'validation still precedes');
    for (let i = 0; i < 25; i++) assert.equal((await b.post('/api/auth/otp', { phone: '0555830001' })).s, 503, 'not turned into 429 by the limiter either'); } finally { await b.stop(); } });

test('secure mode with an injected sender: random code is handed to the sender only; response reveals nothing', async () => {
  const sent = []; const b = await boot({ dev: false, sendSms: (p, c) => sent.push([p, c]) }); try { const r = await b.post('/api/auth/otp', { phone: '0555830002' });
    assert.equal(r.s, 200); assert.deepEqual(r.j, { ok: true }, 'no dev flag, no code'); assert.equal(sent.length, 1); assert.equal(sent[0][0], '+213555830002'); assert.match(sent[0][1], /^\d{6}$/);
    if (sent[0][1] !== '123456') assert.equal((await b.post('/api/auth/verify', { phone: '0555830002', code: '123456' })).s, 400);
    assert.equal((await b.post('/api/auth/verify', { phone: '0555830002', code: sent[0][1] })).s, 200); } finally { await b.stop(); } });

test('secure mode, sender throws: 502 sms_failed, OTP row removed, error text never contains the code', async () => {
  let seen; const b = await boot({ dev: false, sendSms: (p, c) => { seen = c; throw new Error('gateway down ' + c); } }); try { const r = await b.post('/api/auth/otp', { phone: '0555830003' });
    assert.equal(r.s, 502); assert.deepEqual(r.j, { error: 'sms_failed' }); assert.equal(b.otps(), 0); assert.ok(seen); assert.ok(!JSON.stringify(r.j).includes(seen)); } finally { await b.stop(); } });

test('dev mode keeps the explicit demo behaviour: 123456 works and the response says dev:true; the sender is not called', async () => {
  let called = 0; const b = await boot({ dev: true, sendSms: () => { called++; } }); try { const r = await b.post('/api/auth/otp', { phone: '0555830004' });
    assert.equal(r.s, 200); assert.deepEqual(r.j, { ok: true, dev: true }); assert.equal(called, 0); assert.equal((await b.post('/api/auth/verify', { phone: '0555830004', code: '123456' })).s, 200); } finally { await b.stop(); } });
