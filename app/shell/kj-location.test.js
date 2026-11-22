// Run: node --test app/shell/kj-location.test.js
// Exercises the KJLoc permission state machine against a fake Capacitor Geolocation plugin and a fake DOM.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'kj-location.js'), 'utf8');

class El {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.className = ''; this.textContent = ''; this.onclick = null; this.parent = null; }
  append(...c) { c.forEach(x => { x.parent = this; this.children.push(x); }); }
  appendChild(c) { this.append(c); return c; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {}
  focus() {}
  set innerHTML(v) { this._h = v; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  all(out = []) { out.push(this); this.children.forEach(c => c.all(out)); return out; }
}

function setup({ platform = 'android', perms, onRequest, position, lang = 'fr', seen = false } = {}) {
  const calls = { request: [], position: 0, settings: [], hrefs: [] };
  const state = { perms: perms || { location: 'prompt', coarseLocation: 'prompt' } };
  const store = new Map(seen ? [['kj.loc.rationale', '1']] : []);
  const body = new El('body');
  const win = {
    Capacitor: {
      isNativePlatform: () => true, getPlatform: () => platform,
      Plugins: {
        Geolocation: {
          checkPermissions: async () => ({ ...state.perms }),
          requestPermissions: async a => { calls.request.push(a); if (onRequest) state.perms = onRequest(state.perms); return { ...state.perms }; },
          getCurrentPosition: async () => { calls.position++; if (position instanceof Error) throw position; return position || { coords: { latitude: 36.75, longitude: 3.05, accuracy: 20 } }; }
        },
        NativeSettings: { open: o => calls.settings.push(o) }
      }
    },
    location: { set href(v) { calls.hrefs.push(v); } },
    addEventListener() {}
  };
  const document = { documentElement: { lang }, body, createElement: t => new El(t), activeElement: null };
  const ctx = vm.createContext({ window: win, document, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) }, Promise, Error, isFinite, String, Date, setTimeout });
  vm.runInContext(SRC, ctx);
  const sheets = () => body.children.filter(c => c.className === 'kjl-ov');
  const press = (label) => { const b = body.all().find(e => e.tag === 'button' && e.textContent === label); assert.ok(b, 'button not found: ' + label); b.onclick(); };
  const titleOf = () => { const h = body.all().find(e => e.className === 'kjl-h'); return h && h.textContent; };
  return { KJ: win.KJLoc, calls, state, sheets, press, titleOf, body };
}
const wait = () => new Promise(r => setImmediate(r));

test('granted (precise): reads position silently, no sheet, no permission request', async () => {
  const t = setup({ perms: { location: 'granted', coarseLocation: 'granted' } });
  const r = await t.KJ.ensure({ role: 'rider', interactive: false });
  assert.equal(r.ok, true); assert.equal(r.approx, false); assert.equal(t.sheets().length, 0); assert.equal(t.calls.request.length, 0);
});

test('granted (approximate only): ok but flagged approximate so the UI can warn', async () => {
  const t = setup({ perms: { location: 'denied', coarseLocation: 'granted' } });
  const r = await t.KJ.ensure({ role: 'rider', interactive: false });
  assert.equal(r.ok, true); assert.equal(r.approx, true);
});

test('denied: automatic use never prompts, never shows a sheet, never reads', async () => {
  const t = setup({ perms: { location: 'denied', coarseLocation: 'denied' } });
  const r = await t.KJ.ensure({ role: 'rider', interactive: false });
  assert.deepEqual([r.ok, r.reason], [false, 'denied']);
  assert.equal(t.sheets().length, 0); assert.equal(t.calls.request.length, 0); assert.equal(t.calls.position, 0);
});

test('denied: user tap shows the denied sheet; Settings opens app settings (android), manual falls back', async () => {
  const t = setup({ perms: { location: 'denied', coarseLocation: 'denied' } });
  const p = t.KJ.ensure({ role: 'rider', interactive: true }); await wait();
  assert.equal(t.sheets().length, 1); assert.equal(t.titleOf(), 'Localisation désactivée');
  t.press('Ouvrir les réglages'); const r = await p;
  assert.deepEqual([r.ok, r.reason], [false, 'denied']);
  assert.deepEqual(t.calls.settings[0].optionAndroid, 'application_details'); assert.equal(t.calls.request.length, 0);
  const t2 = setup({ perms: { location: 'denied', coarseLocation: 'denied' } });
  const p2 = t2.KJ.ensure({ role: 'rider', interactive: true }); await wait(); t2.press('Choisir manuellement');
  assert.equal((await p2).reason, 'denied'); assert.equal(t2.calls.settings.length, 0);
});

test('iOS settings button uses the public app-settings: URL', async () => {
  const t = setup({ platform: 'ios', perms: { location: 'denied', coarseLocation: 'denied' } });
  const p = t.KJ.ensure({ role: 'rider', interactive: true }); await wait(); t.press('Ouvrir les réglages'); await p;
  assert.deepEqual(t.calls.hrefs, ['app-settings:']);
});

test('prompt: rationale first, native request only after the user allows, then position is read', async () => {
  const t = setup({ onRequest: () => ({ location: 'granted', coarseLocation: 'granted' }) });
  const p = t.KJ.ensure({ role: 'rider', interactive: true }); await wait();
  assert.equal(t.calls.request.length, 0, 'no OS prompt before our explanation');
  assert.equal(t.titleOf(), 'Utiliser votre position');
  t.press('Autoriser la localisation'); const r = await p;
  assert.equal(r.ok, true); assert.deepEqual([...t.calls.request[0].permissions], ['location', 'coarseLocation']);
});

test('prompt: choosing manual never triggers the OS prompt', async () => {
  const t = setup();
  const p = t.KJ.ensure({ role: 'rider', interactive: true }); await wait(); t.press('Choisir manuellement');
  const r = await p; assert.deepEqual([r.ok, r.reason], [false, 'manual']); assert.equal(t.calls.request.length, 0); assert.equal(t.calls.position, 0);
});

test('prompt: OS dialog answered "deny" -> reason denied, no position read, no second prompt', async () => {
  const t = setup({ onRequest: () => ({ location: 'denied', coarseLocation: 'denied' }) });
  const p = t.KJ.ensure({ role: 'rider', interactive: true }); await wait(); t.press('Autoriser la localisation');
  const r = await p; assert.equal(r.reason, 'denied'); assert.equal(t.calls.request.length, 1); assert.equal(t.calls.position, 0);
  const again = await t.KJ.ensure({ role: 'rider', interactive: false });
  assert.equal(again.reason, 'denied'); assert.equal(t.calls.request.length, 1, 'no automatic re-prompt');
});

test('automatic start explains at most once per install, then stays quiet', async () => {
  const t = setup();
  const p = t.KJ.ensure({ role: 'rider', interactive: false }); await wait();
  assert.equal(t.sheets().length, 1); t.press('Choisir manuellement'); await p;
  const r = await t.KJ.ensure({ role: 'rider', interactive: false });
  assert.deepEqual([r.ok, r.reason], [false, 'suppressed']); assert.equal(t.sheets().length, 0);
  const t2 = setup({ seen: true }); assert.equal((await t2.KJ.ensure({ role: 'rider', interactive: false })).reason, 'suppressed');
});

test('android re-ask state (prompt-with-rationale) is never prompted automatically', async () => {
  const t = setup({ perms: { location: 'prompt-with-rationale', coarseLocation: 'prompt-with-rationale' } });
  const r = await t.KJ.ensure({ role: 'rider', interactive: false });
  assert.equal(r.reason, 'suppressed'); assert.equal(t.sheets().length, 0); assert.equal(t.calls.request.length, 0);
});

test('revoked from Settings while the app runs: next read reports denied and does not read the plugin', async () => {
  const t = setup({ perms: { location: 'granted', coarseLocation: 'granted' } });
  assert.equal((await t.KJ.ensure({ role: 'driver', interactive: false })).ok, true);
  t.state.perms = { location: 'denied', coarseLocation: 'denied' }; const before = t.calls.position;
  const r = await t.KJ.ensure({ role: 'driver', interactive: false });
  assert.deepEqual([r.ok, r.reason], [false, 'denied']); assert.equal(t.calls.position, before);
});

test('GPS off: classified services_off; interactive shows the GPS sheet and Settings opens the Location screen', async () => {
  const granted = { location: 'granted', coarseLocation: 'granted' };
  const t = setup({ perms: granted, position: Object.assign(new Error('Location services are not enabled'), { code: 'OS-PLUG-GLOC-0007' }) });
  assert.equal((await t.KJ.ensure({ role: 'rider', interactive: false })).reason, 'services_off');
  const t2 = setup({ perms: granted, position: new Error('Location services are not enabled') });
  const p = t2.KJ.ensure({ role: 'rider', interactive: true }); await wait();
  assert.equal(t2.titleOf(), 'Le GPS est désactivé'); t2.press('Ouvrir les réglages'); await p;
  assert.equal(t2.calls.settings[0].optionAndroid, 'location');
});

test('timeout and unknown failures are reported, never thrown, and offer retry when interactive', async () => {
  const g = { location: 'granted', coarseLocation: 'granted' };
  assert.equal((await setup({ perms: g, position: new Error('Timeout expired') }).KJ.ensure({ interactive: false })).reason, 'timeout');
  assert.equal((await setup({ perms: g, position: new Error('boom') }).KJ.ensure({ interactive: false })).reason, 'unavailable');
  const t = setup({ perms: g, position: new Error('boom') });
  const p = t.KJ.ensure({ role: 'rider', interactive: true }); await wait(); assert.equal(t.titleOf(), 'Position indisponible');
  t.press('Choisir manuellement'); assert.equal((await p).reason, 'unavailable');
});

test('invalid coordinates are rejected', async () => {
  const t = setup({ perms: { location: 'granted', coarseLocation: 'granted' }, position: { coords: { latitude: NaN, longitude: 3, accuracy: 5 } } });
  assert.equal((await t.KJ.ensure({ interactive: false })).ok, false);
});

test('Always/background location is never requested; Arabic copy is shown in Arabic', async () => {
  const t = setup({ lang: 'ar', onRequest: () => ({ location: 'granted', coarseLocation: 'granted' }) });
  const p = t.KJ.ensure({ role: 'rider', interactive: true }); await wait();
  assert.equal(t.titleOf(), 'نحددو موقعك'); t.press('السماح بالموقع'); await p;
  assert.ok(t.calls.request.every(a => a.permissions.every(x => !/background|always/i.test(x))));
});

test('driver rationale explains online-only sharing and has no "choose manually" pickup option', async () => {
  const t = setup(); const p = t.KJ.ensure({ role: 'driver', interactive: true }); await wait();
  const labels = t.body.all().filter(e => e.tag === 'button').map(e => e.textContent);
  assert.ok(!labels.includes('Choisir manuellement')); t.press('Fermer'); assert.equal((await p).reason, 'manual');
});
