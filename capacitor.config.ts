import type { CapacitorConfig } from '@capacitor/cli';

const productionOrigin = process.env.KHERJA_APP_ORIGIN;

const config: CapacitorConfig = {
  appId: 'com.kherja.app',
  appName: 'KHERJA',
  webDir: 'app',
  server: productionOrigin
    ? { url: productionOrigin, cleartext: false }
    : undefined,
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  ios: {
    contentInset: 'automatic',
    // capacitor-native-settings ships private `App-prefs:` URLs on iOS (App Review risk); iOS opens the app's
    // Settings page through the public `app-settings:` URL instead, so only Geolocation is linked on iOS.
    includePlugins: ['@capacitor/geolocation'],
  },
};

export default config;
