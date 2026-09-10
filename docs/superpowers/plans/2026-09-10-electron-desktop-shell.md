# Electron Desktop Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows Electron Forge shell that loads existing `apps/web` (localhost in dev, Vercel in packaged builds) and provides tray, app menu, and system notifications.

**Architecture:** New `apps/desktop` package compiles main + preload with `@electron-forge/plugin-vite`. The BrowserWindow `loadURL`s the Next app; a tiny Vite renderer is only the offline/retry page. Pure URL/notify/close helpers are unit-tested without launching Electron. `apps/web` gets an optional `getDesktopBridge()` that no-ops in the browser.

**Tech Stack:** Electron Forge 7.11, Electron 37, Vite 5, TypeScript, Vitest, pnpm workspace.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-10-electron-desktop-shell-design.md`
- Formatting: root `.prettierrc` (LF, no semicolons, double quotes, 80 print width)
- User-facing copy in Simplified Chinese
- Windows only; maker is **Squirrel.Windows** (`@electron-forge/maker-squirrel`)
- Do **not** add a `build` script to `desktop` (root `turbo build` must not package Electron)
- Default `pnpm dev` must **not** start Electron
- Packaged load URL is `XT_DESKTOP_APP_URL` baked in at `package`/`make` time; must be `https:`
- Dev load URL is always `http://localhost:3000`
- `webPreferences`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`
- Expose only `window.electronDesktop` (`isDesktop`, `notify`, `retryLoad`) — never raw `ipcRenderer`
- Product name **XtAi Notion**; AppUserModelId / appId `com.xtai.notion.desktop`
- Do not commit `.env` or secrets
- Do not add Forge `make` to CI
- Every new/changed code block needs at least one useful comment (intent, not narration)

## File Map

| File | Responsibility |
|------|----------------|
| `apps/desktop/package.json` | Forge scripts, deps; **no** `build` script |
| `apps/desktop/forge.config.ts` | Squirrel maker, Vite plugin, fuses, appId |
| `apps/desktop/vite.main.config.ts` | Main bundle + `__XT_DESKTOP_APP_URL__` define |
| `apps/desktop/vite.preload.config.ts` | Preload bundle |
| `apps/desktop/vite.renderer.config.ts` | Offline page only |
| `apps/desktop/tsconfig.json` | Desktop TS (bundler resolution) |
| `apps/desktop/vitest.config.ts` | Node tests for pure helpers |
| `apps/desktop/eslint.config.js` | Shared base config |
| `apps/desktop/.env.example` | `XT_DESKTOP_APP_URL=` |
| `apps/desktop/src/vite-env.d.ts` | Forge + define globals |
| `apps/desktop/src/lib/urls.ts` | Allowlist, load URL, https assert |
| `apps/desktop/src/lib/notify.ts` | Notify payload sanitize |
| `apps/desktop/src/lib/window-policy.ts` | Hide-on-close |
| `apps/desktop/src/lib/env-file.ts` | Parse `.env` text for URL injection |
| `apps/desktop/src/preload.ts` | `contextBridge` API |
| `apps/desktop/src/main.ts` | Window, tray, menu, IPC, navigation |
| `apps/desktop/index.html` | Offline / retry page (Forge renderer root) |
| `apps/desktop/src/renderer.ts` | Retry button → `retryLoad` |
| `apps/desktop/src/desktop-api.d.ts` | Shared `Window.electronDesktop` types |
| `apps/desktop/scripts/assert-packaged-url.ts` | Fail `package`/`make` without https URL |
| `apps/desktop/test/*.test.ts` | Pure helper tests |
| `apps/web/lib/desktop-bridge.ts` | Optional bridge for Next |
| `apps/web/test/lib/desktop-bridge.test.ts` | Bridge null vs present |
| `package.json` | `dev:desktop` |
| `pnpm-workspace.yaml` | `allowBuilds` for electron |
| `.gitignore` | `.vite/` |
| `README.md` | Short desktop section |

---

### Task 1: Desktop package + URL / notify / close helpers

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/vitest.config.ts`
- Create: `apps/desktop/eslint.config.js`
- Create: `apps/desktop/.env.example`
- Create: `apps/desktop/src/lib/urls.ts`
- Create: `apps/desktop/src/lib/notify.ts`
- Create: `apps/desktop/src/lib/window-policy.ts`
- Create: `apps/desktop/src/lib/env-file.ts`
- Create: `apps/desktop/test/urls.test.ts`
- Create: `apps/desktop/test/notify.test.ts`
- Create: `apps/desktop/test/window-policy.test.ts`
- Create: `apps/desktop/test/env-file.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `DEV_WEB_URL: "http://localhost:3000"`
  - `DEV_WEB_ORIGINS: readonly ["http://localhost:3000", "http://127.0.0.1:3000"]`
  - `getAppLoadUrl(isPackaged: boolean, packagedAppUrl: string): string`
  - `assertHttpsAppUrl(raw: string | undefined): string`
  - `isAllowedNavigationUrl(rawUrl: string, allowedOrigins: string[]): boolean`
  - `getAllowedOrigins(input: { isPackaged: boolean; packagedAppUrl: string; viteDevServerUrl?: string }): string[]`
  - `resolveWindowOpenAction(rawUrl: string, allowedOrigins: string[]): "load-in-window" | "open-external" | "deny"`
  - `sanitizeNotifyPayload(input: unknown): { title: string; body: string } | null`
  - `shouldHideOnClose(isQuitting: boolean): boolean`
  - `readEnvValue(fileContents: string, key: string): string | undefined`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/test/urls.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  DEV_WEB_URL,
  assertHttpsAppUrl,
  getAllowedOrigins,
  getAppLoadUrl,
  isAllowedNavigationUrl,
  resolveWindowOpenAction,
} from "../src/lib/urls"

describe("getAppLoadUrl", () => {
  it("uses localhost when unpackaged", () => {
    expect(getAppLoadUrl(false, "https://app.vercel.app")).toBe(DEV_WEB_URL)
  })

  it("strips trailing slash when packaged", () => {
    expect(getAppLoadUrl(true, "https://app.vercel.app/")).toBe(
      "https://app.vercel.app"
    )
  })
})

describe("assertHttpsAppUrl", () => {
  it("rejects missing and non-https values", () => {
    expect(() => assertHttpsAppUrl(undefined)).toThrow(/XT_DESKTOP_APP_URL/)
    expect(() => assertHttpsAppUrl("http://insecure.example")).toThrow(/https/)
  })

  it("returns a trimmed https origin URL", () => {
    expect(assertHttpsAppUrl(" https://app.vercel.app/ ")).toBe(
      "https://app.vercel.app"
    )
  })
})

describe("navigation allowlist", () => {
  const devOrigins = getAllowedOrigins({
    isPackaged: false,
    packagedAppUrl: "https://app.vercel.app",
    viteDevServerUrl: "http://localhost:5173/",
  })

  it("allows Next and Vite renderer origins in development", () => {
    expect(isAllowedNavigationUrl("http://localhost:3000/login", devOrigins)).toBe(
      true
    )
    expect(
      isAllowedNavigationUrl("http://localhost:5173/index.html", devOrigins)
    ).toBe(true)
    expect(isAllowedNavigationUrl("https://evil.example/", devOrigins)).toBe(
      false
    )
  })

  it("only allows the packaged origin when packaged", () => {
    const origins = getAllowedOrigins({
      isPackaged: true,
      packagedAppUrl: "https://app.vercel.app",
    })
    expect(isAllowedNavigationUrl("https://app.vercel.app/docs", origins)).toBe(
      true
    )
    expect(isAllowedNavigationUrl("http://localhost:3000/", origins)).toBe(false)
  })

  it("opens http(s) off-origin in the system browser", () => {
    expect(resolveWindowOpenAction("https://github.com", devOrigins)).toBe(
      "open-external"
    )
    expect(resolveWindowOpenAction("file:///etc/passwd", devOrigins)).toBe(
      "deny"
    )
    expect(
      resolveWindowOpenAction("http://localhost:3000/square", devOrigins)
    ).toBe("load-in-window")
  })
})
```

Create `apps/desktop/test/notify.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { sanitizeNotifyPayload } from "../src/lib/notify"

describe("sanitizeNotifyPayload", () => {
  it("returns null for missing title", () => {
    expect(sanitizeNotifyPayload({})).toBeNull()
    expect(sanitizeNotifyPayload({ title: "  " })).toBeNull()
  })

  it("trims and truncates title and body", () => {
    const title = "t".repeat(80)
    const body = "b".repeat(300)
    expect(sanitizeNotifyPayload({ title, body, extra: 1 })).toEqual({
      title: "t".repeat(64),
      body: "b".repeat(256),
    })
  })
})
```

Create `apps/desktop/test/window-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { shouldHideOnClose } from "../src/lib/window-policy"

describe("shouldHideOnClose", () => {
  it("hides when the user did not quit", () => {
    expect(shouldHideOnClose(false)).toBe(true)
  })

  it("allows close when quitting", () => {
    expect(shouldHideOnClose(true)).toBe(false)
  })
})
```

Create `apps/desktop/test/env-file.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { readEnvValue } from "../src/lib/env-file"

describe("readEnvValue", () => {
  it("reads the first unquoted assignment and skips comments", () => {
    const text = "# x\nXT_DESKTOP_APP_URL=https://app.vercel.app/\n"
    expect(readEnvValue(text, "XT_DESKTOP_APP_URL")).toBe(
      "https://app.vercel.app/"
    )
  })
})
```

- [ ] **Step 2: Add the desktop package harness so tests can run**

`apps/desktop/package.json` (no `build` script):

```json
{
  "name": "desktop",
  "productName": "XtAi Notion",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": ".vite/build/main.js",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts"
  },
  "devDependencies": {
    "@workspace/eslint-config": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "@types/node": "^20",
    "eslint": "^9",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

`apps/desktop/tsconfig.json`:

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src", "test", "scripts", "forge.config.ts", "vite.*.ts", "vitest.config.ts"]
}
```

`apps/desktop/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
})
```

`apps/desktop/eslint.config.js`:

```js
import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    ignores: [".vite/**", "out/**"],
  },
]
```

`apps/desktop/.env.example`:

```
XT_DESKTOP_APP_URL=
```

From repo root: `pnpm install`

- [ ] **Step 3: Run tests and confirm they fail (modules missing)**

Run: `pnpm --filter desktop test`

Expected: FAIL resolving `../src/lib/urls` (and the other lib imports).

- [ ] **Step 4: Implement the helpers**

`apps/desktop/src/lib/env-file.ts`:

```ts
/** Parse a dotenv snippet without pulling in a dotenv runtime dependency. */
export function readEnvValue(
  fileContents: string,
  key: string
): string | undefined {
  for (const rawLine of fileContents.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    if (line.slice(0, eq) !== key) continue
    return line.slice(eq + 1).replace(/^["']|["']$/g, "")
  }
  return undefined
}
```

`apps/desktop/src/lib/window-policy.ts`:

```ts
/** Close hides the window unless the user chose 退出. */
export function shouldHideOnClose(isQuitting: boolean): boolean {
  return !isQuitting
}
```

`apps/desktop/src/lib/notify.ts`:

```ts
const TITLE_MAX = 64
const BODY_MAX = 256

export type NotifyPayload = {
  title: string
  body: string
}

/** Renderer input is untrusted; empty titles must not reach Notification. */
export function sanitizeNotifyPayload(input: unknown): NotifyPayload | null {
  if (!input || typeof input !== "object") return null
  const record = input as { title?: unknown; body?: unknown }
  const title = typeof record.title === "string" ? record.title.trim() : ""
  if (!title) return null
  const body = typeof record.body === "string" ? record.body.trim() : ""
  return {
    title: title.slice(0, TITLE_MAX),
    body: body.slice(0, BODY_MAX),
  }
}
```

`apps/desktop/src/lib/urls.ts`:

```ts
export const DEV_WEB_URL = "http://localhost:3000"

export const DEV_WEB_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const

export type WindowOpenAction = "load-in-window" | "open-external" | "deny"

export function getAppLoadUrl(
  isPackaged: boolean,
  packagedAppUrl: string
): string {
  if (!isPackaged) return DEV_WEB_URL
  return packagedAppUrl.replace(/\/$/, "")
}

export function assertHttpsAppUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/$/, "") ?? ""
  if (!trimmed) {
    throw new Error("XT_DESKTOP_APP_URL is required for packaging")
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error("XT_DESKTOP_APP_URL must be a valid https URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("XT_DESKTOP_APP_URL must be an https URL")
  }
  return trimmed
}

export function isAllowedNavigationUrl(
  rawUrl: string,
  allowedOrigins: string[]
): boolean {
  try {
    return allowedOrigins.includes(new URL(rawUrl).origin)
  } catch {
    return false
  }
}

export function getAllowedOrigins(input: {
  isPackaged: boolean
  packagedAppUrl: string
  viteDevServerUrl?: string
}): string[] {
  if (input.isPackaged) {
    return [new URL(input.packagedAppUrl).origin]
  }
  const origins: string[] = [...DEV_WEB_ORIGINS]
  if (input.viteDevServerUrl) {
    try {
      origins.push(new URL(input.viteDevServerUrl).origin)
    } catch {
      // Ignore malformed Vite URLs; Next origins still apply.
    }
  }
  return origins
}

export function resolveWindowOpenAction(
  rawUrl: string,
  allowedOrigins: string[]
): WindowOpenAction {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return "deny"
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "deny"
  }
  if (isAllowedNavigationUrl(rawUrl, allowedOrigins)) {
    return "load-in-window"
  }
  return "open-external"
}
```

- [ ] **Step 5: Re-run tests and typecheck**

Run: `pnpm --filter desktop test && pnpm --filter desktop typecheck`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop docs/superpowers/specs/2026-09-10-electron-desktop-shell-design.md
git commit -m "feat(desktop): add URL, notify, and close-policy helpers"
```

---

### Task 2: Forge Vite app that loads the web URL

**Files:**
- Modify: `apps/desktop/package.json` (add Forge/Electron scripts and deps)
- Create: `apps/desktop/forge.config.ts`
- Create: `apps/desktop/vite.main.config.ts`
- Create: `apps/desktop/vite.preload.config.ts`
- Create: `apps/desktop/vite.renderer.config.ts`
- Create: `apps/desktop/src/vite-env.d.ts`
- Create: `apps/desktop/src/preload.ts`
- Create: `apps/desktop/src/main.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/renderer.ts`
- Create: `apps/desktop/src/desktop-api.d.ts`
- Modify: `pnpm-workspace.yaml` (`allowBuilds.electron` and `electron-winstaller`)

**Interfaces:**
- Consumes: `getAppLoadUrl`, `assertHttpsAppUrl`, `readEnvValue`
- Produces:
  - IPC `desktop:notify` and `desktop:retry-load`
  - `window.electronDesktop: { isDesktop: true; notify(payload: { title: string; body: string }): Promise<boolean>; retryLoad(): Promise<void> }`
  - `pnpm --filter desktop start` launches Electron

- [ ] **Step 1: Allow Electron native builds and add Forge dependencies**

In `pnpm-workspace.yaml` add:

```yaml
  electron: true
  electron-winstaller: true
```

Update `apps/desktop/package.json` scripts and dependencies (keep lint/typecheck/test). Do **not** add `build`:

```json
{
  "scripts": {
    "dev": "electron-forge start",
    "start": "electron-forge start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "electron-squirrel-startup": "^1.0.1"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.11.1",
    "@electron-forge/maker-squirrel": "^7.11.1",
    "@electron-forge/plugin-fuses": "^7.11.1",
    "@electron-forge/plugin-vite": "^7.11.1",
    "@electron-forge/shared-types": "^7.11.1",
    "@electron/fuses": "^1.8.0",
    "@types/electron-squirrel-startup": "^1.0.2",
    "@workspace/eslint-config": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "@types/node": "^20",
    "electron": "^37.2.0",
    "eslint": "^9",
    "tsx": "^4.20.3",
    "typescript": "^5",
    "vite": "^5.4.19",
    "vitest": "^4.1.10"
  }
}
```

Run from repo root: `pnpm install`

- [ ] **Step 2: Add Forge + Vite config (Squirrel only, no Darwin/Linux makers)**

`apps/desktop/forge.config.ts`:

```ts
import { FusesPlugin } from "@electron-forge/plugin-fuses"
import { VitePlugin } from "@electron-forge/plugin-vite"
import type { ForgeConfig } from "@electron-forge/shared-types"
import { MakerSquirrel } from "@electron-forge/maker-squirrel"
import { FuseV1Options, FuseVersion } from "@electron/fuses"

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "XtAi Notion",
    appBundleId: "com.xtai.notion.desktop",
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({})],
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
```

`apps/desktop/vite.main.config.ts`:

```ts
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { readEnvValue } from "./src/lib/env-file"

function packagedAppUrl(): string {
  const fromEnv = process.env.XT_DESKTOP_APP_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env")
  if (!existsSync(envPath)) return ""
  const value = readEnvValue(readFileSync(envPath, "utf8"), "XT_DESKTOP_APP_URL")
  return (value ?? "").replace(/\/$/, "")
}

export default defineConfig({
  define: {
    // Empty in `start`; `package`/`make` assert https before Forge runs.
    __XT_DESKTOP_APP_URL__: JSON.stringify(packagedAppUrl()),
  },
})
```

`apps/desktop/vite.preload.config.ts` and `apps/desktop/vite.renderer.config.ts`:

```ts
import { defineConfig } from "vite"

export default defineConfig({})
```

(same content in both files)

`apps/desktop/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string
declare const __XT_DESKTOP_APP_URL__: string
```

- [ ] **Step 3: Implement preload and a main process that loads Next**

`apps/desktop/src/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron"
import type { DesktopNotifyPayload } from "./desktop-api"

/** Narrow API only — do not expose ipcRenderer. */
contextBridge.exposeInMainWorld("electronDesktop", {
  isDesktop: true as const,
  notify: (payload: DesktopNotifyPayload) =>
    ipcRenderer.invoke("desktop:notify", payload) as Promise<boolean>,
  retryLoad: () => ipcRenderer.invoke("desktop:retry-load") as Promise<void>,
})
```

`apps/desktop/index.html` (Forge Vite renderer entry at package root):

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    />
    <title>XtAi Notion</title>
  </head>
  <body>
    <main>
      <h1>无法打开工作台</h1>
      <p id="hint">
        开发环境请先运行 pnpm --filter web dev，再点击重试。安装包请检查网络与站点。
      </p>
      <button id="retry" type="button">重试</button>
    </main>
    <script type="module" src="/src/renderer.ts"></script>
  </body>
</html>
```

`apps/desktop/src/renderer.ts`:

```ts
const retry = document.getElementById("retry")

retry?.addEventListener("click", () => {
  void window.electronDesktop?.retryLoad()
})
```

`apps/desktop/src/desktop-api.d.ts` (used by renderer and preload):

```ts
export type DesktopNotifyPayload = {
  title: string
  body: string
}

export type ElectronDesktopApi = {
  isDesktop: true
  notify: (payload: DesktopNotifyPayload) => Promise<boolean>
  retryLoad: () => Promise<void>
}

declare global {
  interface Window {
    electronDesktop?: ElectronDesktopApi
  }
}
```

`apps/desktop/src/main.ts` (window load only; tray/menu in Task 3 — but register IPC stubs so the offline page compiles). For this task include: squirrel startup, AppUserModelId, single-instance lock, BrowserWindow with security prefs, `loadURL(getAppLoadUrl(...))`, `did-fail-load` → offline renderer, `desktop:retry-load` handler.

```ts
import path from "node:path"
import started from "electron-squirrel-startup"
import { app, BrowserWindow, ipcMain } from "electron"
import { DEV_WEB_URL, assertHttpsAppUrl, getAppLoadUrl } from "./lib/urls"

if (started) {
  app.quit()
}

app.setAppUserModelId("com.xtai.notion.desktop")

let mainWindow: BrowserWindow | null = null

function packagedAppUrl(): string {
  if (!app.isPackaged) return ""
  return assertHttpsAppUrl(__XT_DESKTOP_APP_URL__)
}

function preloadPath(): string {
  return path.join(__dirname, "preload.js")
}

async function loadOffline(win: BrowserWindow): Promise<void> {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    return
  }
  await win.loadFile(
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  )
}

async function loadApp(win: BrowserWindow): Promise<void> {
  const url = getAppLoadUrl(app.isPackaged, packagedAppUrl())
  await win.loadURL(url)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, _desc, _url, isMainFrame) => {
      // -3 is ABORTED (redirects); ignore so we do not flash the offline page.
      if (!isMainFrame || errorCode === -3) return
      void loadOffline(win)
    }
  )

  void loadApp(win)
  return win
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

app.whenReady().then(() => {
  ipcMain.handle("desktop:retry-load", async () => {
    if (mainWindow) await loadApp(mainWindow)
  })
  ipcMain.handle("desktop:notify", async () => false)
  mainWindow = createWindow()
})
```

- [ ] **Step 4: Smoke-check Forge start (web may be down → offline page)**

Run: `pnpm --filter desktop start`

Expected: Electron window opens (Next or the Chinese offline page). No sandbox/nodeIntegration warnings. Quit from OS window chrome for now (hide-on-close is Task 3).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(desktop): scaffold Electron Forge Vite shell that loadURLs web"
```

---

### Task 3: Tray, menu, hide-on-close, notifications

**Files:**
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/lib/notify.ts` only if needed (already done)

**Interfaces:**
- Consumes: `shouldHideOnClose`, `sanitizeNotifyPayload`
- Produces: tray (show / quit), application menu including 测试通知, close hides, `desktop:notify` shows `Notification`

- [ ] **Step 1: Replace the notify stub and add tray / menu / hide behavior in `main.ts`**

Keep Task 2 load helpers. Add:

```ts
import {
  Menu,
  Notification,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
} from "electron"
import { sanitizeNotifyPayload } from "./lib/notify"
import { shouldHideOnClose } from "./lib/window-policy"

let isQuitting = false
let tray: Tray | null = null

const TRAY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR4nGP4z8BQDwAEgQGAhKmMIQAAAABJRU5ErkJggg=="

function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function quitApp(): void {
  isQuitting = true
  app.quit()
}

function showTestNotification(): void {
  void showNotification({
    title: "XtAi Notion",
    body: "这是一条测试通知",
  })
}

function showNotification(payload: unknown): boolean {
  const clean = sanitizeNotifyPayload(payload)
  if (!clean || !Notification.isSupported()) return false
  try {
    const notification = new Notification({
      title: clean.title,
      body: clean.body,
    })
    notification.on("click", () => showMainWindow())
    notification.show()
    return true
  } catch {
    return false
  }
}

function buildAppMenu(): Menu {
  const viewChildren: MenuItemConstructorOptions[] = [
    { role: "reload", label: "重新加载" },
  ]
  if (!app.isPackaged) {
    viewChildren.push({ role: "toggleDevTools", label: "开发者工具" })
  }
  return Menu.buildFromTemplate([
    {
      label: "文件",
      submenu: [
        { label: "显示主窗口", click: () => showMainWindow() },
        { type: "separator" },
        { label: "退出", click: () => quitApp() },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    { label: "视图", submenu: viewChildren },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { label: "显示", click: () => showMainWindow() },
      ],
    },
    {
      label: "帮助",
      submenu: [{ label: "测试通知", click: () => showTestNotification() }],
    },
  ])
}

function createTray(): Tray {
  const icon = nativeImage.createFromDataURL(TRAY_PNG)
  const nextTray = new Tray(icon)
  nextTray.setToolTip("XtAi Notion")
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示主窗口", click: () => showMainWindow() },
      { label: "退出", click: () => quitApp() },
    ])
  )
  nextTray.on("click", () => showMainWindow())
  return nextTray
}
```

Wire in `createWindow` after construction:

```ts
  win.on("close", (event) => {
    if (!shouldHideOnClose(isQuitting)) return
    event.preventDefault()
    win.hide()
  })
```

In `whenReady`:

```ts
  Menu.setApplicationMenu(buildAppMenu())
  tray = createTray()
  ipcMain.handle("desktop:notify", async (_event, payload: unknown) =>
    showNotification(payload)
  )
```

On `window-all-closed`, do **not** `app.quit()` (tray keeps the process alive).

On `before-quit`, if `isQuitting` is still false because of a non-menu path, leave hide behavior as specified: only 退出 sets the flag.

- [ ] **Step 2: Manual check**

Run `pnpm --filter web dev` then `pnpm --filter desktop start`.

Checklist: close window → tray remains; tray click shows window; 帮助 → 测试通知; 退出 ends process.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main.ts
git commit -m "feat(desktop): add tray, app menu, hide-on-close, and notifications"
```

---

### Task 4: Navigation allowlist, offline retry, packaged URL assert

**Files:**
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/package.json` (add `package` and `make` scripts)
- Create: `apps/desktop/scripts/assert-packaged-url.ts`

**Interfaces:**
- Consumes: `getAllowedOrigins`, `isAllowedNavigationUrl`, `resolveWindowOpenAction`, `assertHttpsAppUrl`, `readEnvValue`
- Produces: `will-navigate` + `setWindowOpenHandler` behavior from the spec; `pnpm --filter desktop package` fails without https `XT_DESKTOP_APP_URL`

- [ ] **Step 1: Add package/make scripts and the assert helper**

In `apps/desktop/package.json` scripts add (still no `build`):

```json
"package": "tsx scripts/assert-packaged-url.ts && electron-forge package",
"make": "tsx scripts/assert-packaged-url.ts && electron-forge make"
```

`apps/desktop/scripts/assert-packaged-url.ts`:

```ts
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { readEnvValue } from "../src/lib/env-file"
import { assertHttpsAppUrl } from "../src/lib/urls"

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env")
const fromFile = existsSync(envPath)
  ? readEnvValue(readFileSync(envPath, "utf8"), "XT_DESKTOP_APP_URL")
  : undefined

assertHttpsAppUrl(process.env.XT_DESKTOP_APP_URL ?? fromFile)
```

- [ ] **Step 2: Confirm package fails without URL**

Run: `pnpm --filter desktop package`

Expected: FAIL with `XT_DESKTOP_APP_URL is required for packaging` (no `.env` / env var).

- [ ] **Step 3: Attach navigation + window-open handlers in `createWindow`**

```ts
import { shell } from "electron"
import {
  getAllowedOrigins,
  isAllowedNavigationUrl,
  resolveWindowOpenAction,
} from "./lib/urls"

function allowedOrigins(): string[] {
  return getAllowedOrigins({
    isPackaged: app.isPackaged,
    packagedAppUrl: packagedAppUrl() || DEV_WEB_URL,
    viteDevServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  })
}

function attachNavigationGuards(win: BrowserWindow): void {
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url, allowedOrigins())) {
      event.preventDefault()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    const action = resolveWindowOpenAction(url, allowedOrigins())
    if (action === "load-in-window") {
      void win.loadURL(url)
    } else if (action === "open-external") {
      void shell.openExternal(url)
    }
    return { action: "deny" }
  })
}
```

Call `attachNavigationGuards(win)` inside `createWindow` before `loadApp`.

- [ ] **Step 4: Re-run unit tests**

Run: `pnpm --filter desktop test && pnpm --filter desktop typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main.ts apps/desktop/scripts/assert-packaged-url.ts apps/desktop/package.json
git commit -m "feat(desktop): restrict navigation and fail packaging without https app URL"
```

---

### Task 5: Web bridge + monorepo scripts

**Files:**
- Create: `apps/web/lib/desktop-bridge.ts`
- Create: `apps/web/test/lib/desktop-bridge.test.ts`
- Modify: `package.json` (root `dev:desktop`)
- Modify: `.gitignore` (`.vite/`)
- Modify: `README.md` (short 桌面端 section)

**Interfaces:**
- Consumes: `window.electronDesktop` shape from Task 2 (`isDesktop`, `notify`, `retryLoad`)
- Produces: `getDesktopBridge(): ElectronDesktopApi | null`

- [ ] **Step 1: Write the failing web test**

`apps/web/test/lib/desktop-bridge.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"
import { getDesktopBridge } from "@/lib/desktop-bridge"

afterEach(() => {
  delete window.electronDesktop
})

describe("getDesktopBridge", () => {
  it("returns null in a normal browser", () => {
    expect(getDesktopBridge()).toBeNull()
  })

  it("returns the API when Electron injected it", () => {
    window.electronDesktop = {
      isDesktop: true,
      notify: async () => true,
      retryLoad: async () => undefined,
    }
    expect(getDesktopBridge()?.isDesktop).toBe(true)
  })
})
```

- [ ] **Step 2: Run the web test and confirm it fails**

Run: `pnpm --filter web test -- test/lib/desktop-bridge.test.ts`

Expected: FAIL (cannot resolve `@/lib/desktop-bridge` or `window.electronDesktop`).

- [ ] **Step 3: Implement the bridge**

`apps/web/lib/desktop-bridge.ts`:

```ts
export type DesktopNotifyPayload = {
  title: string
  body: string
}

export type ElectronDesktopApi = {
  isDesktop: true
  notify: (payload: DesktopNotifyPayload) => Promise<boolean>
  retryLoad: () => Promise<void>
}

declare global {
  interface Window {
    electronDesktop?: ElectronDesktopApi
  }
}

/** Browser and SSR have no preload; callers must null-check. */
export function getDesktopBridge(): ElectronDesktopApi | null {
  if (typeof window === "undefined") return null
  return window.electronDesktop ?? null
}
```

Do **not** wire `notify` into comments/collaboration in this task (spec: menu 测试通知 is enough).

- [ ] **Step 4: Re-run the web test**

Run: `pnpm --filter web test -- test/lib/desktop-bridge.test.ts`

Expected: PASS

- [ ] **Step 5: Root wiring and README**

`.gitignore` — add a line `.vite/` next to other build artifacts.

Root `package.json` scripts, keep existing `dev` filters unchanged, add:

```json
"dev:desktop": "turbo dev --filter=web --filter=desktop"
```

`README.md` add a section after local-dev commands:

```markdown
## 桌面端（Windows）

开发：先配置好 `apps/web` 与 API，再执行 `pnpm dev:desktop`（或分别 `pnpm --filter web dev` 与 `pnpm --filter desktop start`）。窗口加载 `http://localhost:3000`。关闭窗口会缩到托盘，托盘或菜单「退出」才结束进程。

打安装包：在 `apps/desktop/.env` 设置 `XT_DESKTOP_APP_URL` 为线上 Vercel `https` 地址，然后 `pnpm --filter desktop package` 或 `pnpm --filter desktop make`。未配置该变量时构建会失败。默认 `pnpm dev` 不会启动 Electron。
```

- [ ] **Step 6: Format and verify**

Run:

```
pnpm --filter desktop test && pnpm --filter desktop typecheck && pnpm --filter desktop lint
pnpm --filter web test -- test/lib/desktop-bridge.test.ts
```

If Prettier is not applied, run `pnpm --filter desktop exec prettier --write` on touched desktop files and `pnpm --filter web format` as needed.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/desktop-bridge.ts apps/web/test/lib/desktop-bridge.test.ts package.json .gitignore README.md
git commit -m "feat(web): add optional Electron desktop bridge and desktop dev script"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `apps/desktop` Forge Vite + TypeScript, `loadURL` | 2 |
| Dev `http://localhost:3000`, packaged `XT_DESKTOP_APP_URL` baked at package time | 1, 2, 4 |
| Squirrel only | 2 |
| Security webPreferences + narrow preload | 2 |
| Tray show/hide/quit, tooltip XtAi Notion | 3 |
| App menu 文件/编辑/视图/窗口/帮助测试通知 | 3 |
| Close hides; quit from tray/menu | 3 |
| Notification sanitize + click focuses window | 1, 3 |
| AppUserModelId | 2 |
| Single instance | 2 |
| will-navigate allowlist; window-open deny + load or openExternal | 1, 4 |
| Offline page + retry | 2, 4 |
| package fails without https URL | 4 |
| `getDesktopBridge()` null in browser | 5 |
| No default `pnpm dev` Electron; no CI make; no desktop `build` | 2, 5 |
| Fuses integrity | 2 |
