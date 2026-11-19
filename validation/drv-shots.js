const { chromium } = require('playwright'); const { createApp } = require('/home/claude/kherja/backend/server');
(async () => { const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port; const out = process.argv[2], th = process.argv[3], lang = process.argv[4];
 const call = async (ck, m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { r, j }; };
 const acc = async (ph, role, nm) => { await call(null, 'POST', '/api/auth/otp', { phone: ph }); const v = await call(null, 'POST', '/api/auth/verify', { phone: ph, code: '123456', role }); const ck = 'sid=' + /sid=([^;]+)/.exec(v.r.headers.get('set-cookie'))[1]; await call(ck, 'POST', '/api/me', { name: nm, lang }); return ck; };
 const rider = await acc('0555000301', 'rider', 'Karim'), drv = await acc('0555000302', 'driver', 'Ethan');
 await call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '1234-111-16' }); await call(drv, 'POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
 const rq = await call(rider, 'POST', '/api/requests', { pickup: { lat: 36.75, lng: 3.05, label: 'Bab Ezzouar' }, dropoff: { lat: 36.69, lng: 3.21, label: 'Aéroport' }, price: 450 });
 const of = await call(drv, 'POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 }); const ac = await call(rider, 'POST', `/api/offers/${of.j.id}/accept`);
 for (const s of ['arrived', 'in_progress', 'completed']) await call(drv, 'POST', `/api/rides/${ac.j.ride_id}/status`, { status: s });
 await call(drv, 'POST', '/api/safety/contacts', { name: 'Frère', phone: '0787654321' });
 const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: th }); await c.addCookies([{ name: 'sid', value: drv.slice(4), url: base }]); const p = await c.newPage(); await p.goto(base + '/app/driver');
 await p.waitForSelector('.tabbar [data-tab=account]'); await p.locator('.tabbar [data-tab=account]').click(); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/d-account.png` });
 for (const id of ['dm-act', 'dm-notif', 'dm-cont', 'dm-set', 'dm-rep']) { await p.locator(`#dm-menu [data-dm=${id}]`).click(); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/d-${id}.png` }); await p.locator(`#${id} [data-dmback]`).click(); await p.waitForTimeout(300); }
 await b.close(); srv.close(); })();
