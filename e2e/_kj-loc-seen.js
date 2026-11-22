// Preload for the e2e suite (node --require). KHERJA shows a one-time location explanation sheet on a fresh install
// (localStorage "kj.loc.rationale"). Existing e2e flows test other features, so every browser context they create starts
// as a returning install. e2e/location-permission.test.js removes the flag again to exercise the fresh-install path.
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts) => {
    const ctx = await newContext(opts);
    await ctx.addInitScript(() => { try { if (!localStorage.getItem('kj.loc.rationale')) localStorage.setItem('kj.loc.rationale', '1'); } catch (e) {} });
    return ctx;
  };
  return browser;
};
