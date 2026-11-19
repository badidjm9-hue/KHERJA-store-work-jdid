import type { CapacitorConfig } from '@capacitor/cli';

const productionOrigin = process.env.KHERJA_APP_ORIGIN;

const config: CapacitorConfig = {
  appId: 'com.kherja.app',
  appName: 'KHERJA',
  webDir: 'app',
  bundledWebRuntime: false,
  server: productionOrigin
    ? { url: productionOrigin, cleartext: false }
    : undefined,
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
