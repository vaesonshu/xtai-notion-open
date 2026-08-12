// Lightweight E2E script using undici + tough-cookie to simulate browser login
// and create-document flow without a real browser. This is intended to run in
// CI where Playwright is not available.

import { fetch } from "undici"
import { CookieJar } from "tough-cookie"

async function nodeFetchWithCookies(url, opts = {}, jar) {
  const cookieHeader = (await jar.getCookieString(url)) || ""
  const headers = Object.assign({}, opts.headers || {}, {})
  if (cookieHeader) headers.cookie = cookieHeader
  const res = await fetch(url, Object.assign({}, opts, { headers }))
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) {
    await jar.setCookie(setCookie, url)
  }
  return res
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3100"
  const jar = new CookieJar()

  const email = `e2e-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = "password123"

  console.log("Registering user", email)
  let res = await nodeFetchWithCookies(`${baseUrl}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ email, password, displayName: "E2E" }),
    headers: { "content-type": "application/json" },
  }, jar)
  if (!res.ok) throw new Error(`register failed ${res.status}`)

  console.log("Logging in")
  res = await nodeFetchWithCookies(`${baseUrl}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "content-type": "application/json" },
  }, jar)
  if (!res.ok) throw new Error(`login failed ${res.status}`)

  console.log("Creating document")
  res = await nodeFetchWithCookies(`${baseUrl}/documents`, {
    method: "POST",
  }, jar)
  if (!res.ok) throw new Error(`create document failed ${res.status}`)
  const doc = await res.json()
  console.log("Created document:", doc)

  console.log("Logging out")
  res = await nodeFetchWithCookies(`${baseUrl}/auth/logout`, { method: "POST" }, jar)
  if (!res.ok) throw new Error(`logout failed ${res.status}`)

  console.log("E2E flow completed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
