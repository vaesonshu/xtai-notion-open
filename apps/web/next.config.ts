import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@workspace/editor",
    "@workspace/icons",
  ],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
    NEXT_PUBLIC_COLLABORATION_URL:
      process.env.NEXT_PUBLIC_COLLABORATION_URL ?? "",
    NEXT_PUBLIC_DEV_USER_ID: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "",
  },
  // Workspace packages export TypeScript source with ESM-style paths;
  // keep an explicit turbopack block so Next 16 does not reject sibling webpack hints.
  turbopack: {},
}

export default nextConfig
