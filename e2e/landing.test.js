const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');
test('landing: renders, no overflow on mobile, waitlist form works, a11y names, no fake proof', async () => {
  const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const url = 'http://127.0.0.1:' + srv.address().port + '/landing';
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 360, height: 740 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto(url); await p.getByRole('heading', { name: 'سعرك يبقى سعرك' }).waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll');
    assert.equal(await p.locator('img:not([alt])').count(), 0);
    const body = await p.locator('body').innerText(); assert.ok(!/\d+\s*(ألف|مستخدم|تقييم)|★|trusted by/i.test(body), 'no invented proof');
    await p.getByLabel('رقم الهاتف').fill('12'); await p.getByRole('button', { name: 'سجّلني' }).click(); await p.getByText('غير صحيح').waitFor();
    await p.getByLabel('رقم الهاتف').fill('0555123999'); await p.getByLabel('أنا').selectOption('driver'); await p.getByRole('button', { name: 'سجّلني' }).click(); await p.getByText('تم تسجيلك').waitFor();
    assert.deepEqual({ ...srv.db.prepare('select phone,role from waitlist').get() }, { phone: '+213555123999', role: 'driver' });
    assert.deepEqual(errs, []);
  } finally { await b.close(); srv.close(); }
});
