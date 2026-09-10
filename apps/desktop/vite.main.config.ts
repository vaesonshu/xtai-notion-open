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
  const value = readEnvValue(
    readFileSync(envPath, "utf8"),
    "XT_DESKTOP_APP_URL"
  )
  return (value ?? "").replace(/\/$/, "")
}

export default defineConfig({
  define: {
    // Empty in `start`; `package`/`make` assert https before Forge runs.
    __XT_DESKTOP_APP_URL__: JSON.stringify(packagedAppUrl()),
  },
})
