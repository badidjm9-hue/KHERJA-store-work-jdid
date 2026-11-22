#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const required = [
  'app/index.html', 'app/driver.html', 'app/admin.html',
  'app/assets/kj-icon-1024.png', 'app/assets/kj-icon-512.png',
  'app/assets/apple-touch-icon.png', 'capacitor.config.ts', 'STORE-RELEASE-PREP.md'
];
let fail = false;
for (const item of required) {
  const full = path.join(root, item);
  const ok = fs.existsSync(full) && fs.statSync(full).size > 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${item}`);
  if (!ok) fail = true;
}
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
for (const [label, condition] of [
  ['viewport configured', /name="viewport"/.test(html)],
  ['manifest referenced', /manifest\.webmanifest/.test(html)],
  ['no obvious localhost API hardcode', !/https?:\/\/localhost:\d+/.test(html)],
  ['admin is separate web entry', fs.existsSync(path.join(root, 'app/admin.html'))],
  ['admin declares mobile viewport', /name=\"viewport\"/.test(fs.readFileSync(path.join(root, 'app/admin.html'), 'utf8'))],
  ['admin has responsive breakpoint', /@media\s*\(max-width:\s*820px\)/.test(fs.readFileSync(path.join(root, 'app/admin.html'), 'utf8'))],
  ['admin has no fixed page width', !/body\s*\{[^}]*min-width:\s*[0-9]{3,}px/i.test(fs.readFileSync(path.join(root, 'app/admin.html'), 'utf8'))],
  ['Capacitor config does not target admin', !/admin\.html/.test(fs.readFileSync(path.join(root, 'capacitor.config.ts'), 'utf8'))]
]) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) fail = true;
}
const manifestPath = path.join(root, 'app/manifest.webmanifest');
if (fs.existsSync(manifestPath)) {
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`${m.name ? 'PASS' : 'FAIL'} manifest name`);
    if (!m.name) fail = true;
  } catch (e) { console.log('FAIL manifest JSON'); fail = true; }
} else { console.log('WARN manifest absent'); }
// Release guard: the native shell must load the production HTTPS origin. Without KHERJA_APP_ORIGIN, `cap sync`
// bundles app/ (legacy offline rider page, no API) into the store binary. Enforced with --release or KHERJA_RELEASE=1.
if (process.argv.includes('--release') || process.env.KHERJA_RELEASE === '1') {
  const o = process.env.KHERJA_APP_ORIGIN || '';
  let okOrigin = false;
  try { const u = new URL(o); okOrigin = u.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname) && !/(staging|dev|test)/i.test(u.hostname); } catch (e) {}
  console.log(`${okOrigin ? 'PASS' : 'FAIL'} KHERJA_APP_ORIGIN is a production https origin${o ? ' (' + o + ')' : ' (unset)'}`);
  if (!okOrigin) fail = true;
}
// Native permission/privacy config must stay in sync with the code (see ios/ and android/ native projects).
const nat = (rel) => { const f = path.join(root, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
const man = nat('android/app/src/main/AndroidManifest.xml'), plist = nat('ios/App/App/Info.plist'), priv = nat('ios/App/App/PrivacyInfo.xcprivacy'), pbx = nat('ios/App/App.xcodeproj/project.pbxproj');
if (man !== null) for (const [label, c] of [
  ['android: fine+coarse location declared', /ACCESS_FINE_LOCATION/.test(man) && /ACCESS_COARSE_LOCATION/.test(man)],
  ['android: no background location', !/<uses-permission[^>]*ACCESS_BACKGROUND_LOCATION/.test(man)],
  ['android: no foreground-service permission', !/<uses-permission[^>]*FOREGROUND_SERVICE/.test(man)],
  ['android: backups disabled', /allowBackup="false"/.test(man)]]) { console.log(`${c ? 'PASS' : 'FAIL'} ${label}`); if (!c) fail = true; }
if (plist !== null) for (const [label, c] of [
  ['ios: NSLocationWhenInUseUsageDescription', /NSLocationWhenInUseUsageDescription/.test(plist)],
  ['ios: no Always location keys', !/NSLocationAlways/.test(plist)],
  ['ios: no background location mode', !/<string>location<\/string>/.test(plist)],
  ['ios: PrivacyInfo.xcprivacy exists', priv !== null && /NSPrivacyTracking/.test(priv)],
  ['ios: PrivacyInfo.xcprivacy is in the target Resources phase', pbx !== null && /PrivacyInfo\.xcprivacy in Resources/.test(pbx)]]) { console.log(`${c ? 'PASS' : 'FAIL'} ${label}`); if (!c) fail = true; }
console.log(fail ? '\nRelease preflight FAILED' : '\nRelease preflight passed (web assets only; native build/signing not checked)');
process.exit(fail ? 1 : 0);
