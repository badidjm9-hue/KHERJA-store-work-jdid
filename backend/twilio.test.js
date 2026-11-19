'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTwilioSmsSender } = require('./server');

test('Twilio sender is disabled until all credentials are supplied', async () => {
  assert.equal(await createTwilioSmsSender({}), null);
  await assert.rejects(() => createTwilioSmsSender({ TWILIO_ACCOUNT_SID: 'ACbad', TWILIO_AUTH_TOKEN: 'x', TWILIO_FROM: 'KHERJA' }), /invalid TWILIO_ACCOUNT_SID/);
});

test('Twilio sender posts OTP over HTTPS and rejects provider failures', async t => {
  const oldFetch = global.fetch;
  t.after(() => { global.fetch = oldFetch; });
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ sid: 'SM' + 'a'.repeat(32), status: 'queued' }) };
  };
  const sender = await createTwilioSmsSender({
    TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32),
    TWILIO_AUTH_TOKEN: 'secret-test-token',
    TWILIO_FROM: 'KHERJA'
  });
  const result = await sender('+213555123456', '482915');
  assert.equal(result.status, 'queued');
  assert.match(request.url, /^https:\/\/api\.twilio\.com\//);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const body = new URLSearchParams(request.options.body);
  assert.equal(body.get('To'), '+213555123456');
  assert.equal(body.get('From'), 'KHERJA');
  assert.match(body.get('Body'), /482915/);
  assert.equal(body.get('Body').includes('secret-test-token'), false);

  global.fetch = async () => ({ ok: false, status: 401 });
  await assert.rejects(() => sender('+213555123456', '482915'), /Twilio SMS request failed/);
});
