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
console.log(fail ? '\nRelease preflight FAILED' : '\nRelease preflight passed (web assets only; native build/signing not checked)');
process.exit(fail ? 1 : 0);
