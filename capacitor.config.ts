import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meow.app',
  appName: 'Meow',

  // Next's static export lands here. This is the same folder served as the
  // website, so the web and native builds are byte-identical — see the note
  // in next.config.ts. Run `next build` before `cap sync`.
  webDir: 'out',

  android: {
    // Serve the bundled files over https://localhost rather than the default
    // http://localhost. Android treats http origins as insecure, which blocks
    // secure-context-only browser APIs and trips cleartext-traffic policy.
    //
    // This is the Origin the WebView sends to the API, so it must appear in
    // the backend's CORS_ORIGINS allowlist.
    androidScheme: 'https',
  },
};

export default config;
