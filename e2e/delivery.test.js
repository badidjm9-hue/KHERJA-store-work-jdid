const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');

const driverLogin = async (p, phone, name) => { await p.getByLabel('رقم الهاتف').fill(phone); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
  const b = p.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill('123456'[i]); await p.getByRole('button', { name: 'تأكيد' }).click();
  await p.getByLabel('الاسم').fill(name); await p.getByLabel('الطراز').fill('Renault Symbol'); await p.getByLabel('رقم اللوحة').fill('12345-116-' + phone.slice(-2)); await p.getByRole('button', { name: 'التالي' }).click(); };

test('delivery: rider orders a parcel, courier negotiates, accepts, both get call links', async () => {
  const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch(); const errs = [];
  const mk = async (path = '') => { const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(base + path); return p; };
  const login = async (p, phone, name) => { await p.getByRole('button', { name: 'متابعة' }).click(); await p.getByLabel('رقم الهاتف').fill(phone); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
    const b = p.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill('123456'[i]); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.getByLabel('الاسم').fill(name); await p.getByRole('button', { name: 'ابدأ' }).click(); };
  try {
    const rider = await mk(), courier = await mk('/driver'); await login(rider, '0555000011', 'Amine'); await driverLogin(courier, '0666000022', 'Karim'); await courier.getByRole('button', { name: 'الرئيسية' }).click();
    await courier.context().grantPermissions(['geolocation']); await courier.context().setGeolocation({ latitude: 36.7538, longitude: 3.0588 }); await courier.getByRole('switch').click();
    await rider.getByRole('button', { name: /توصيل/ }).first().click(); await rider.getByRole('button', { name: 'حدّد سعر التوصيل' }).click();
    // validation: description required
    await rider.getByRole('button', { name: 'ابحث عن موصّل' }).click(); await rider.getByText('اكتب وصف الطلب').waitFor();
    await rider.getByRole('button', { name: 'طرد' }).click(); await rider.getByLabel('وصف الطلب').fill('كيس ملابس');
    await rider.getByLabel('عنوان الاستلام').fill('محل الأناقة، باب الزوار'); await rider.getByLabel('عنوان التسليم').fill('حي 5 جويلية، الجزائر');
    await rider.getByLabel('اسم المستلم').fill('سارة'); await rider.getByLabel('هاتف المستلم').fill('0661000222');
    await rider.getByRole('button', { name: 'ابحث عن موصّل' }).click();
    await courier.getByText('كيس ملابس').waitFor({ timeout: 8000 });
    assert.equal(await courier.getByText('0661000222').count(), 0, 'recipient phone hidden before accept');
    await courier.getByRole('button', { name: /اقترح/ }).click();
    await rider.locator('.offer').first().waitFor({ timeout: 8000 }); assert.match(await rider.locator('.offer .pr b').first().innerText(), /500/);
    await rider.locator('.offer [data-ok]').first().click();
    await rider.getByText(/سيصل الموصّل إلى عنوانك ويتصل بك/).waitFor();
    await rider.waitForFunction(() => document.querySelector('#d-phone')?.getAttribute('href'), null, { timeout: 8000 }); // contact phone is fetched via GET /api/rides/:id after accept; wait for it, then assert exactly as before
    assert.match(await rider.locator('#d-phone').getAttribute('href'), /^tel:\+213666000022$/);
    await courier.getByRole('link', { name: 'اتصل بالمستلم' }).waitFor({ timeout: 8000 });
    assert.equal(await courier.getByRole('link', { name: 'اتصل بالمستلم' }).getAttribute('href'), 'tel:+213661000222');
    assert.equal(await courier.getByRole('link', { name: 'اتصل بالطالب' }).getAttribute('href'), 'tel:+213555000011');
    for (const l of ['وصلت', 'ابدأ الرحلة', 'أنهِ الرحلة']) await courier.getByRole('button', { name: l }).click({ timeout: 8000 });
    await rider.getByRole('heading', { name: 'تم التسليم' }).waitFor({ timeout: 8000 });
    const r = srv.db.prepare("select status,locked_price from rides").get(); assert.deepEqual({ ...r }, { status: 'completed', locked_price: 500 });
    const rq = srv.db.prepare('select kind,item_type,item_note,recipient_phone from requests').get(); assert.deepEqual({ ...rq }, { kind: 'delivery', item_type: 'parcel', item_note: 'كيس ملابس', recipient_phone: '+213661000222' });
    assert.deepEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});

test('delivery on mobile 360: form scrolls, no horizontal overflow, targets >= 44px', async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 360, height: 700 } })).newPage(); await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'app', 'index.html')).href);
  try {
    await p.getByRole('button', { name: 'متابعة' }).click(); await p.getByLabel('رقم الهاتف').fill('0555123456'); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
    const o = p.locator('#otp input'); for (let i = 0; i < 6; i++) await o.nth(i).fill('123456'[i]); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.getByRole('button', { name: 'ابدأ' }).click();
    await p.getByRole('button', { name: /توصيل/ }).first().click(); await p.getByRole('button', { name: 'حدّد سعر التوصيل' }).click(); await p.waitForTimeout(600);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const small = await p.evaluate(() => [...document.querySelectorAll('#sh-request button,#sh-request input:not([type=checkbox])')].filter(e => e.offsetParent).map(e => [e.id || e.textContent.trim().slice(0, 10), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
    assert.deepEqual(small, []); assert.equal(await p.evaluate(() => { const s = document.querySelector('#sh-request'); return s.scrollHeight >= s.clientHeight; }), true);
  } finally { await b.close(); }
});
