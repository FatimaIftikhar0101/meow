import { Capacitor } from '@capacitor/core';

/**
 * True when running inside the Capacitor native shell (Android/iOS) rather
 * than a browser.
 *
 * The same `out/` bundle is served as the website and packaged into the app,
 * so anything that should differ between the two is a *runtime* check like
 * this one — not a separate build. Safe to call on the web, where Capacitor
 * reports the "web" platform and this returns false.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Whether to mount the WebGL globe.
 *
 * Disabled on native: three.js is the heaviest thing the app renders, phone
 * GPUs are far weaker than the laptops it was tuned on, and the dashboard
 * already had a reported stall from it on desktop. The globe is decorative —
 * the dashboard's actual content (balance, corridors, transfers) is unaffected.
 *
 * Because next/dynamic only fetches the Three.js chunk when the component
 * mounts, returning false here also keeps that chunk off the device entirely
 * rather than merely hiding it.
 */
export function shouldRenderGlobe(): boolean {
  return !isNative();
}
