import type { NextConfig } from "next";

const apiBase = "https://holodex.net";
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: "/stats.json", destination: `${apiBase}/stats.json` },
      { source: "/orgs.json", destination: `${apiBase}/orgs.json` },
    ];
  },
};
export default nextConfig;
