import type { NextConfig } from "next"

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/editor", "@workspace/icons"],
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_COLLABORATION_URL:
      process.env.NEXT_PUBLIC_COLLABORATION_URL ?? "",
    NEXT_PUBLIC_DEV_USER_ID: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "",
  },
  // Workspace packages export TypeScript source with ESM-style paths;
  // keep an explicit turbopack block so Next 16 does not reject sibling webpack hints.
  turbopack: {},
  async rewrites() {
    // Only proxy auth traffic so the browser keeps the session cookie on the
    // web origin. /share must NOT be rewritten here: a broad "/share/:path*"
    // rule would swallow the app/share/[token] page route and forward every
    // page request to the API, which only implements POST /share/:token/accept
    // and would 404 the rest. Share acceptance is proxied by its own route.ts.
    return apiUrl
      ? [{ source: "/auth/:path*", destination: `${apiUrl}/auth/:path*` }]
      : []
  },
}

export default nextConfig
