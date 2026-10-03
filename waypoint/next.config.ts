import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  // Lives inside another repo; pin the root so the parent app is not picked up.
  turbopack: { root: path.resolve(".") },
  // The tracker is long-cached; bump ?v= in the snippet when it changes.
  async headers() {
    return [{ source: "/w.js", headers: [{ key: "cache-control", value: "public, max-age=3600" }, { key: "access-control-allow-origin", value: "*" }] }];
  },
};
export default config;
