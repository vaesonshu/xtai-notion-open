/**
 * Hocuspocus expects a WebSocket URL; misconfigured env often uses https://
 * from the Render dashboard — rewrite to wss:// without changing host/path.
 */
export function normalizeCollaborationWebSocketUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ""
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`
  }
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`
  }
  return trimmed
}
