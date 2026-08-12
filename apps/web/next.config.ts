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
    // Keep browser auth requests on the web origin so session cookies do not
    // break when local development mixes localhost with 127.0.0.1.
    return apiUrl
      ? [{ source: "/auth/:path*", destination: `${apiUrl}/auth/:path*` }]
      : []
  },
}

export default nextConfig
