// DERIVED from e2e/onboarding.test.js: the same flow, but rider and driver both enter through the one-app shell (/app, /app/driver).
// Regenerate by re-running the substitution if the legacy test changes. Run: node --test e2e/shell-legacy-onboarding.test.js
// Driver signs up, uploads 4 documents; admin reviews in the web console; driver goes online. Run: node --test e2e/onboarding.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64');

test('driver onboarding + admin validation + gating', async () => {
  const srv = createApp({ dev: true, devAdmin: true, requireApproval: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch(); const errs = [];
  const mk = async (path, ctxOpts = {}) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, ...ctxOpts }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); await p.goto(base + path); return p; };
  try {
    const d = await mk('/app/driver', { permissions: ['geolocation'], geolocation: { latitude: 36.7538, longitude: 3.0588 } });
    await d.getByLabel('رقم الهاتف').fill('0666111222'); await d.getByRole('button', { name: 'إرسال الرمز' }).click();
    const b = d.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill('123456'[i]); await d.getByRole('button', { name: 'تأكيد' }).click();
    await d.getByLabel('الاسم').fill('Karim'); await d.getByLabel('الطراز').fill('Dacia Logan'); await d.getByLabel('رقم اللوحة').fill('98765-117-16'); await d.getByRole('button', { name: 'التالي' }).click();
    await d.getByRole('heading', { name: 'الوثائق' }).waitFor();
    const kinds = ['vehicle_photo', 'license', 'registration', 'insurance'];
    for (const k of kinds.slice(0, 3)) { await d.locator(`input[data-kind="${k}"]`).setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG }); await d.locator(`input[data-kind="${k}"]`).waitFor({ state: 'attached' }); await d.waitForTimeout(500); }
    await d.getByRole('button', { name: 'الرئيسية' }).click();
    assert.equal(await d.getByRole('switch').isDisabled(), true, 'cannot go online with 3/4 docs');
    await d.getByRole('button', { name: 'الوثائق' }).first().click();
    await d.locator('input[data-kind="insurance"]').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG }); await d.waitForTimeout(700);
    assert.equal(srv.db.prepare('select count(*) c from driver_docs').get().c, 4);
    await d.getByRole('button', { name: 'الرئيسية' }).click(); await d.getByText(/قيد المراجعة/).first().waitFor();
    assert.equal(await d.getByRole('switch').isDisabled(), true, 'still blocked while pending');

    // admin
    const a = await mk('/admin'); await a.getByLabel('رقم الهاتف').fill('0550000000'); await a.getByLabel('كلمة السر').fill('admin-dev-pass'); await a.getByRole('button', { name: 'دخول' }).click();
    await a.getByRole('heading', { name: 'نظرة عامة' }).waitFor();
    await a.getByRole('link', { name: 'السائقون والوثائق' }).click(); await a.getByRole('row', { name: /Karim/ }).click();
    await a.getByRole('heading', { name: /Karim/ }).waitFor();
    // reject license with reason
    await a.locator('.docc', { hasText: 'رخصة السياقة' }).getByRole('button', { name: 'رفض' }).click(); await a.getByLabel('يظهر للسائق').fill('الصورة غير واضحة'); await a.getByRole('button', { name: 'رفض الوثيقة' }).click();
    await a.locator('.docc', { hasText: 'رخصة السياقة' }).getByText('الصورة غير واضحة').waitFor();
    assert.equal(srv.db.prepare('select docs_status from drivers').get().docs_status, 'rejected');
    await d.reload(); await d.getByText(/رُفضت وثيقة/).waitFor(); await d.getByRole('button', { name: 'الوثائق' }).first().click(); await d.getByText('الصورة غير واضحة').waitFor();
    // driver re-uploads, admin approves all
    await d.locator('input[data-kind="license"]').setInputFiles({ name: 'y.png', mimeType: 'image/png', buffer: PNG }); await d.waitForTimeout(700);
    await a.reload(); await a.getByRole('heading', { name: /Karim/ }).waitFor();
    for (let i = 0; i < 4; i++) { await a.getByRole('button', { name: 'قبول' }).nth(i).click(); await a.waitForTimeout(350); }
    assert.equal(srv.db.prepare('select docs_status from drivers').get().docs_status, 'approved');
    await d.reload(); await d.getByRole('button', { name: 'الرئيسية' }).click(); await d.getByText('حسابك مفعّل').waitFor();
    await d.getByRole('switch').click(); await d.waitForFunction(() => document.querySelector('[role=switch]').getAttribute('aria-checked') === 'true');
    assert.equal(srv.db.prepare('select online from drivers').get().online, 1);
    // suspend
    a.on('dialog', x => x.accept()); await a.getByRole('button', { name: 'إيقاف السائق' }).click(); await a.getByRole('button', { name: 'إلغاء الإيقاف' }).waitFor();
    assert.equal(srv.db.prepare('select online,suspended from drivers').get().suspended, 1);
    // other pages load and logout works
    for (const h of ['rides', 'reports', 'overview']) { await a.goto(base + '/admin#/' + h); await a.waitForTimeout(300); }
    assert.ok(srv.db.prepare('select count(*) c from audit').get().c >= 5);
    assert.deepEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});

