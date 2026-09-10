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
    expect(
      isAllowedNavigationUrl("http://localhost:3000/login", devOrigins)
    ).toBe(true)
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
    expect(isAllowedNavigationUrl("http://localhost:3000/", origins)).toBe(
      false
    )
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
