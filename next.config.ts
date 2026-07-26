import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export. The `out/` folder is the deliverable for BOTH targets:
  // it is served directly as the website, and it is the Capacitor `webDir`
  // bundled into the native app. One build, two products — so the web and
  // mobile versions can never drift apart.
  //
  // The constraint this imposes: no server at runtime. No API routes, no
  // middleware, no server-side data fetching, and no dynamic `[param]`
  // segments (there is nothing to resolve them). All data comes from the
  // NestJS backend over the network via lib/api.ts.
  output: "export",

  // next/image's default loader optimises on demand from a server, which a
  // static export does not have. The app uses plain <img> today; this keeps
  // the build from failing if a next/image is ever added.
  images: { unoptimized: true },

  // Emit `about/index.html` rather than `about.html` so paths resolve the
  // same whether served by a web host or read from the app's local file
  // system by the Capacitor WebView.
  trailingSlash: true,
};

export default nextConfig;
