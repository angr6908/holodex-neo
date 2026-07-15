import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const apiBase = "https://holodex.net";
const withNextIntl = createNextIntlPlugin();
const nextConfig: NextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  // 16.3 generates AGENTS.md/CLAUDE.md on dev by default; opt out.
  agentRules: false,
  compiler: {
    removeConsole: { exclude: ["error"] },
  },
  experimental: {
    optimizePackageImports: ["@mdi/js", "dayjs"],
    // TypeScript 7 ships without the JS compiler API, so `next build` must shell
    // out to the project-local tsc instead of loading it in-process.
    useTypeScriptCli: true,
  },
  async rewrites() {
    return [
      { source: "/stats.json", destination: `${apiBase}/stats.json` },
      { source: "/orgs.json", destination: `${apiBase}/orgs.json` },
    ];
  },
};
export default withNextIntl(nextConfig);
