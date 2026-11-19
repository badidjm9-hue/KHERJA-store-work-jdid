// Guards the test scripts themselves. On Node 22, `node --test a.js missing.js` exits 0 when at least one
// path matches, so a script that names a file which does not exist passes silently. This test fails instead.
// Run: node --test backend/manifest.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tokens = cmd => cmd.split(/\s+/).filter(t => /\.js$/.test(t));
const expand = tok => { if (!tok.includes('*')) return fs.existsSync(path.join(root, tok)) ? [tok] : []; const dir = path.dirname(tok), re = new RegExp('^' + path.basename(tok).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(f => re.test(f)).map(f => dir + '/' + f) : []; };

test('every test file named by a package.json script exists', () => {
  const scripts = Object.entries(pkg.scripts).filter(([, c]) => /--test/.test(c)); assert.ok(scripts.length >= 2, 'test scripts present');
  for (const [name, cmd] of scripts) for (const tok of tokens(cmd)) assert.ok(expand(tok).length > 0, `script "${name}" references "${tok}" which matches no file`);
});

test('test:backend runs every backend test file (none forgotten)', () => {
  const listed = new Set(tokens(pkg.scripts['test:backend']).flatMap(expand));
  const present = fs.readdirSync(__dirname).filter(f => f === 'test.js' || /\.test\.js$/.test(f)).map(f => 'backend/' + f);
  for (const f of present) assert.ok(listed.has(f), `${f} exists but is not run by npm run test:backend`);
  for (const f of listed) assert.ok(present.includes(f), `${f} is listed but missing`);
});

test('test:e2e covers every e2e test file', () => {
  const listed = new Set(tokens(pkg.scripts['test:e2e']).flatMap(expand));
  const present = fs.readdirSync(path.join(root, 'e2e')).filter(f => /\.test\.js$/.test(f)).map(f => 'e2e/' + f);
  assert.ok(present.length > 0); for (const f of present) assert.ok(listed.has(f), `${f} is not run by npm run test:e2e`);
});

test('Node pin is identical in .nvmrc, package.json engines and runtime.js', () => {
  const { EXPECTED_NODE } = require('./runtime'); const nvm = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
  assert.equal('v' + nvm, EXPECTED_NODE); assert.equal('v' + pkg.engines.node, EXPECTED_NODE);
});
