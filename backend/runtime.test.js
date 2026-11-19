'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EXPECTED_NODE, assertSupportedRuntime, runSqliteCanaries } = require('./runtime');
test('runtime pin accepts only the checkpoint Node version in secure mode', () => {
  assert.equal(assertSupportedRuntime({ secure: true, version: EXPECTED_NODE }), true);
  assert.throws(() => assertSupportedRuntime({ secure: true, version: 'v24.0.0' }), /pinned to/);
});
test('runtime mismatch warns but does not block non-production environments', () => {
  assert.equal(assertSupportedRuntime({ secure: false, version: 'v24.0.0' }), false);
});
test('production runtime mismatch is rejected', () => {
  assert.throws(() => assertSupportedRuntime({ secure: true, version: 'v24.0.0' }), /pinned to/);
});
test('SQLite behavioral canaries pass', () => {
  const result = runSqliteCanaries();
  assert.equal(result.ok, true);
  assert.equal(result.node, process.version);
  assert.equal(result.sqlite, process.versions.sqlite);
});
