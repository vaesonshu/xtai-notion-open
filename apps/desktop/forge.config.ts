import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
import { FusesPlugin } from "@electron-forge/plugin-fuses"
import { VitePlugin } from "@electron-forge/plugin-vite"
import type { ForgeConfig } from "@electron-forge/shared-types"
import { MakerSquirrel } from "@electron-forge/maker-squirrel"
import { FuseV1Options, FuseVersion } from "@electron/fuses"

function buildCodexBridgeForPackage(): void {
  execSync("pnpm --filter @xtai-notion/codex-bridge build", {
    cwd: monorepoRoot,
    stdio: "inherit",
  })
}

const config: ForgeConfig = {
  hooks: {
    prePackage: async () => {
      buildCodexBridgeForPackage()
    },
    preMake: async () => {
      buildCodexBridgeForPackage()
    },
  },
  // Forge uses outDir (not packagerConfig.out) for electron-packager output.
  outDir: "release",
  packagerConfig: {
    asar: true,
    name: "XtAi Notion",
    appBundleId: "com.xtai.notion.desktop",
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // Squirrel/nuget requires these fields in the generated .nuspec.
      authors: "xtai-notion-open",
      description: "XtAi Notion 桌面客户端（Windows）",
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
