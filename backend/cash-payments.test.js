'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('./server');
let seq = 0;
async function boot() {
  const s = createApp({ dev: true, devAdmin: true }); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + s.address().port;
  const client = () => { const jar = {}; const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k,v])=>k+'='+v).join('; ') }, body: body ? JSON.stringify(body) : undefined });
    for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k,...v] = kv.split('='); if (/Max-Age=0/i.test(sc)) delete jar[k]; else jar[k] = v.join('='); }
    return { status: r.status, json: r.headers.get('content-type')?.includes('json') ? await r.json() : {} };
  };
  const login = async role => { const phone = '0555' + String(810000 + seq++); await call('POST','/api/auth/otp',{phone}); const r=await call('POST','/api/auth/verify',{phone,code:'123456',role,name:role}); assert.equal(r.status,200); return r; };
  return { call, login }; };
  return { s, client, close: () => new Promise(r => s.close(r)) };
}
const pickup={lat:36.75,lng:3.05,label:'A'}, dropoff={lat:36.69,lng:3.21,label:'B'};
test('cash payment is the default; only the driver can confirm collection after completion', async () => {
  const b=await boot(); try {
    const rider=b.client(), driver=b.client(); await rider.login('rider'); await driver.login('driver');
    await driver.call('POST','/api/driver/profile',{car:'Symbol',plate:'CASH-1'});
    await driver.call('POST','/api/driver/online',{online:true,lat:36.76,lng:3.06});
    const req=await rider.call('POST','/api/requests',{pickup,dropoff,price:500});
    const offer=await driver.call('POST',`/api/requests/${req.json.id}/offers`,{price:500,eta_min:3});
    const accepted=await rider.call('POST',`/api/offers/${offer.json.id}/accept`); const id=accepted.json.ride_id;
    const view=await rider.call('GET',`/api/rides/${id}`);
    assert.equal(view.json.payment_method,'cash'); assert.equal(view.json.payment_status,'pending');
    assert.equal((await driver.call('POST',`/api/rides/${id}/cash-collected`,{})).status,409,'not payable before ride completion');
    assert.equal((await driver.call('GET','/api/driver/cash-due')).json.rides.length,0,'no cash due before completion');
    for (const status of ['arrived','in_progress','completed']) assert.equal((await driver.call('POST',`/api/rides/${id}/status`,{status})).status,200);
    assert.equal((await rider.call('POST',`/api/rides/${id}/cash-collected`,{})).status,403,'rider cannot confirm driver cash collection');
    const due=await driver.call('GET','/api/driver/cash-due'); assert.equal(due.json.rides.length,1); assert.equal(due.json.rides[0].id,id);
    assert.equal((await driver.call('POST',`/api/rides/${id}/cash-collected`,{})).json.payment_status,'paid');
    assert.equal((await driver.call('POST',`/api/rides/${id}/cash-collected`,{})).json.payment_status,'paid','idempotent retry');
    assert.equal((await rider.call('GET',`/api/rides/${id}`)).json.payment_status,'paid');
    assert.equal((await driver.call('GET','/api/driver/cash-due')).json.rides.length,0,'confirmed cash no longer due');
    assert.equal(b.s.db.prepare('select payment_method,payment_status from rides where id=?').get(id).payment_method,'cash');
    assert.throws(()=>b.s.db.prepare("update rides set payment_method='online' where id=?").run(id),/immutable/);
  } finally { await b.close(); }
});
