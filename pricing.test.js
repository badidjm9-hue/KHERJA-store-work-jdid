'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/shell/passenger.view.js', 'utf8');
const fareFactorsSource = source.match(/function fareFactors\([\s\S]*?\n\}/)?.[0];
const suggestedFareSource = source.match(/function suggestedFare\([\s\S]*?\n\}/)?.[0];
assert.ok(fareFactorsSource && suggestedFareSource, 'pricing functions must remain present');
function calculate(vehicleType, km, date) {
  const ctx = { S: { vehicleType }, routeDistanceKm: km, Date, Math };
  // Use a deterministic clock without relying on the host timezone.
  ctx.Date = class extends Date { constructor(){ super(date); } getHours(){ return date.getHours(); } };
  vm.runInNewContext(`${fareFactorsSource}\n${suggestedFareSource}\nresult=suggestedFare()`, ctx);
  return ctx.result;
}
test('daytime car promo applies 5% and rounds to 50 DZD', () => assert.equal(calculate('car', 5, new Date(2026, 0, 1, 12)), 500));
test('daytime moto promo applies 10%, while minimum fare protects short trips', () => assert.equal(calculate('moto', 5, new Date(2026, 0, 1, 12)), 350));
test('rush hour applies estimated 10% increase', () => assert.equal(calculate('car', 5, new Date(2026, 0, 1, 8)), 600));
test('night applies 15% increase', () => assert.equal(calculate('car', 5, new Date(2026, 0, 1, 23)), 650));
test('base pricing is preserved for car and motorcycle', () => {
  assert.equal(calculate('car', 10, new Date(2026, 0, 1, 12)), 800);
  assert.equal(calculate('moto', 10, new Date(2026, 0, 1, 12)), 350);
});
test('missing route falls back to safe displayed suggestions', () => {
  assert.equal(calculate('car', null, new Date(2026, 0, 1, 12)), 450);
  assert.equal(calculate('moto', null, new Date(2026, 0, 1, 12)), 350);
});
