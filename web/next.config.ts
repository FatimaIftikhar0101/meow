import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the build emits plain files into `out/`, deployable to any
  // static host or CDN with no Node server to run or pay for.
  //
  // The app suits this — it has no API routes, no middleware and no
  // server-side data fetching. Everything comes from the NestJS backend over
  // the network via lib/api.ts.
  //
  // The constraint it imposes: no dynamic `[param]` route segments, since
  // there is no server to resolve them. Detail pages take an `?id=` query
  // param instead.
  output: "export",

  // next/image's default loader optimises on demand from a server, which a
  // static export does not have. The app uses plain <img> today; this keeps
  // the build from failing if a next/image is ever added.
  images: { unoptimized: true },

  // Emit `about/index.html` rather than `about.html`, so a path resolves the
  // same on any static host regardless of its extension-rewriting rules.
  trailingSlash: true,
};

export default nextConfig;
