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
