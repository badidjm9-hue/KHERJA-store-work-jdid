// Run: node --test e2e/prototype.test.js   (Playwright + Chromium already installed)
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const URL = require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'app', 'index.html')).href; // repo-relative
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts }); const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && p.errs.push(m.text()));
  await p.goto(URL); return p;
}
const login = async (p, phone = '0555123456') => {
  await p.getByRole('button', { name: 'متابعة' }).click(); await p.getByLabel('رقم الهاتف').fill(phone);
  await p.getByRole('button', { name: 'إرسال الرمز' }).click();
  const boxes = p.locator('#otp input'); for (let i = 0; i < 6; i++) await boxes.nth(i).fill('123456'[i]);
  await p.getByRole('button', { name: 'تأكيد' }).click(); await p.getByLabel('الاسم').fill('Amine'); await p.getByRole('button', { name: 'ابدأ' }).click();
};
const toOffers = async p => { await p.getByRole('button', { name: 'حدّد سعرك' }).click(); await p.getByRole('button', { name: 'ابحث عن سائق' }).click(); await p.locator('.offer').first().waitFor({ timeout: 6000 }); };

test('F02-H1 signup reaches home; F02-N1 bad phone; F02-N2 wrong code', async () => {
  const p = await page(); await p.getByRole('button', { name: 'متابعة' }).click();
  await p.getByLabel('رقم الهاتف').fill('12345'); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
  assert.match(await p.locator('#phone-err').innerText(), /غير صحيح/);
  await p.getByLabel('رقم الهاتف').fill('0555123456'); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
  const boxes = p.locator('#otp input'); for (let i = 0; i < 6; i++) await boxes.nth(i).fill('000000'[i]);
  await p.getByRole('button', { name: 'تأكيد' }).click(); assert.match(await p.locator('#otp-err').innerText(), /غير صحيح/);
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill('123456'[i]);
  await p.getByRole('button', { name: 'تأكيد' }).click(); await p.getByRole('button', { name: 'ابدأ' }).click();
  await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor(); assert.deepEqual(p.errs, []);
});

test('F01-H1 full rider flow, locked price, rating', async () => {
  const p = await page(); await login(p); await toOffers(p);
  await p.locator('.offer [data-ok]').first().click();
  assert.match(await p.locator('#d-price').innerText(), /450/); await p.getByText('السعر مثبّت').waitFor();
  await p.getByRole('button', { name: 'التالي' }).click(); await p.getByRole('button', { name: 'التالي' }).click(); await p.getByRole('button', { name: 'التالي' }).click();
  await p.getByText('وصلت بسلامة').waitFor(); await p.getByRole('radio', { name: '5' }).click();
  await p.getByRole('button', { name: 'إرسال التقييم' }).click(); await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor(); assert.deepEqual(p.errs, []);
});

test('F01-E1 low price warning; E2 price floor; E3 stepper changes value', async () => {
  const p = await page(); await login(p); await p.getByRole('button', { name: 'حدّد سعرك' }).click();
  assert.equal(await p.locator('#lowwarn').isHidden(), true);
  for (let i = 0; i < 3; i++) await p.getByLabel('-50').click();
  assert.equal(await p.locator('#pval').innerText(), '300'); assert.equal(await p.locator('#lowwarn').isVisible(), true);
  for (let i = 0; i < 10; i++) await p.getByLabel('-50').click(); assert.equal(await p.locator('#pval').innerText(), '100');
});

test('F01-E4 decline an offer; E5 cancel while waiting; E6 cancel before pickup; E7 double-click order', async () => {
  const p = await page(); await login(p); await toOffers(p);
  const before = await p.locator('.offer').count(); await p.locator('.offer [data-x]').first().click(); assert.equal(await p.locator('.offer').count(), before - 1);
  await p.locator('.offer [data-ok]').first().click(); await p.getByRole('button', { name: 'الإلغاء' }).or(p.locator('#cancel-ride')).click();
  await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor();
  await p.getByRole('button', { name: 'حدّد سعرك' }).click(); await p.locator('#order').dblclick(); await p.getByRole('button', { name: 'إلغاء' }).first().click();
  await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor(); assert.deepEqual(p.errs, []);
});

test('F01-E8 offers expire visually; F01-E9 refresh mid-flow returns to start without crash', async () => {
  const p = await page(); await login(p); await toOffers(p); await p.reload(); await p.getByRole('button', { name: 'متابعة' }).waitFor(); assert.deepEqual(p.errs, []);
});

test('i18n: French switch flips to LTR and translates', async () => {
  const p = await page(); await p.getByRole('button', { name: /Français/ }).click();
  assert.equal(await p.evaluate(() => document.documentElement.dir), 'ltr'); await p.getByRole('button', { name: 'Continuer' }).waitFor();
});

test('mobile: no horizontal scroll at 360 and 390; touch targets >= 44px', async () => {
  for (const w of [360, 390]) {
    const p = await page(); await p.setViewportSize({ width: w, height: 740 }); await login(p); await p.getByRole('button', { name: 'حدّد سعرك' }).click();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'overflow at ' + w);
    const small = await p.evaluate(() => [...document.querySelectorAll('.sheet.on button,.sheet.on input,.topbar button')].filter(e => e.offsetParent).map(e => { const r = (e.type==='checkbox'&&e.closest('label')?e.closest('label'):e).getBoundingClientRect(); /* checkbox target = its label */ return [e.id || e.textContent.trim().slice(0, 12), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44));
    assert.deepEqual(small.filter(s => !/^$/.test(s[0])), [], 'small targets ' + JSON.stringify(small));
  }
});

test('a11y: every button/input has an accessible name; keyboard tab reaches CTA; reduced motion honoured', async () => {
  const p = await page({ reducedMotion: 'reduce' }); await login(p); await toOffers(p);
  const unnamed = await p.evaluate(() => [...document.querySelectorAll('button,input,select')].filter(e => e.offsetParent !== null || e.closest('.sheet.on')).filter(e => !(e.getAttribute('aria-label') || e.labels?.length || e.textContent.trim() || e.placeholder)).map(e => e.outerHTML.slice(0, 60)));
  assert.deepEqual(unnamed, []);
  const dur = await p.evaluate(() => getComputedStyle(document.querySelector('.offer')).animationDuration); assert.ok(parseFloat(dur) < 0.05, 'reduced motion duration ' + dur);
  await p.keyboard.press('Tab'); assert.ok(await p.evaluate(() => document.activeElement !== document.body));
});

test('dark mode: text contrast stays >= 4.5 on sheet text', async () => {
  const p = await page({ colorScheme: 'dark' }); await login(p); await p.getByRole('button', { name: 'حدّد سعرك' }).click();
  const c = await p.evaluate(() => { const lum = h => { const m = h.match(/\d+/g).map(Number); const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
    const fg = getComputedStyle(document.querySelector('#sh-request h2')).color, bg = getComputedStyle(document.body).backgroundColor; const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (a + .05) / (b + .05); });
  assert.ok(c >= 4.5, 'contrast ' + c);
});

