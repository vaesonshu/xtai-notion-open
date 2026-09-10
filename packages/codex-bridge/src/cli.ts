import { loadBridgeConfig } from "./config.js"
import { startBridgeServer } from "./server.js"

const config = await loadBridgeConfig()
const server = await startBridgeServer(config.port)
const address = server.address()
const port = address && typeof address === "object" ? address.port : config.port

console.log(
  `[inkspace-codex-bridge] listening on http://127.0.0.1:${port} (Ctrl+C to stop)`
)
