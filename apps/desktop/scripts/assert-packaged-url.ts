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
