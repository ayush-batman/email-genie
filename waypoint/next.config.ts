import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  // Lives inside another repo; pin the root so the parent app is not picked up.
  turbopack: { root: path.resolve(".") },
  // The tracker is long-cached; bump ?v= in the snippet when it changes.
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: security },
      // The app can't be framed (clickjacking); shared dashboards can be embedded anywhere.
      { source: "/((?!share/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      { source: "/w.js", headers: [{ key: "cache-control", value: "public, max-age=3600" }, { key: "access-control-allow-origin", value: "*" }] },
    ];
  },
};
export default config;
