// Composes app/kherja.html (the one-app shell) from the legacy rider page's CSS/sprite/logo plus app/shell/*.
// Does NOT touch index.html, driver.html, admin.html or build-apps.js. Run: node app/build-shell.js
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const idx = rd('index.html');
const css = idx.slice(idx.indexOf('<style>') + 7, idx.indexOf('</style>'));
const m = idx.match(/<svg width="0" height="0"[\s\S]*?<\/symbol><\/svg>/); if (!m) throw new Error('sprite not found');
const logo = idx.match(/<div class="logo" aria-hidden="true">[\s\S]*?<\/div>/); if (!logo) throw new Error('logo not found');
// extra icons used by the driver view (same set build-apps.js adds for driver.html)
const A = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
const extra = [['home','<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'],['file','<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'],
 ['user','<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'],['camera','<path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>'],
 ['moto','<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h5l3-7h-4"/><path d="M15 6h3l1 4"/><path d="m11 10 2.5 7"/>'],['check','<path d="m5 12 5 5 9-10"/>'],['x','<path d="M6 6l12 12M18 6 6 18"/>'],
 ['list','<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'],['flag2','<path d="M5 22V4"/><path d="M5 4h13l-2 4 2 4H5"/>'],['users','<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3.5-5 7-5s7 1.5 7 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 15c2.5.5 4 2 4 5"/>']];
const sprite = m[0].replace('</svg>', extra.map(([n, p]) => `<symbol id="i-${n}" ${A}>${p}</symbol>`).join('') + '</svg>');
// optional passenger feature modules (nav, hist, prof, safety, report): shell/passenger.<name>.{html,js,css}, concatenated in this order
const MODS = ['nav', 'hist', 'prof', 'safety', 'report', 'notif', 'init'].filter(n => fs.existsSync(path.join(__dirname, `shell/passenger.${n}.js`)));
const modPart = ext => MODS.map(n => { const p = `shell/passenger.${n}.${ext}`; return fs.existsSync(path.join(__dirname, p)) ? rd(p) : ''; }).join('\n');
let h = rd('shell/shell.template.html');
const put = (k, v) => { if (!h.includes(k)) throw new Error('placeholder missing: ' + k); h = h.split(k).join(v); };
for (const code of ['shell/passenger.view.js', 'shell/driver.view.js', 'shell/driver.more.js', ...MODS.map(n => `shell/passenger.${n}.js`)]) if (/<\/script/i.test(rd(code))) throw new Error(code + ' contains </script');
put('/*__CSS__*/', css); put('/*__DRIVER_CSS__*/', rd('shell/driver.extra.css')); put('/*__SHELL_CSS__*/', rd('shell/shell.extra.css') + '\n' + modPart('css') + '\n' + rd('shell/driver.more.css'));
put('<!--__SPRITE__-->', sprite); put('<!--__LOGO__-->', logo[0]);
put('<!--__VIEW_PASSENGER__-->', rd('shell/passenger.view.html') + '\n' + modPart('html')); put('<!--__VIEW_DRIVER__-->', rd('shell/driver.view.html') + '\n' + rd('shell/driver.more.html'));
put('/*__JS_PASSENGER__*/', rd('shell/passenger.view.js') + '\n' + modPart('js')); put('/*__JS_DRIVER__*/', rd('shell/driver.view.js') + '\n' + rd('shell/driver.more.js'));
fs.writeFileSync(path.join(__dirname, 'kherja.html'), h); console.log('kherja.html', h.length);
