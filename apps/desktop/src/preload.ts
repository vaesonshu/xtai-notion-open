import { contextBridge, ipcRenderer } from "electron"
import type { DesktopNotifyPayload } from "./desktop-api"

/** Narrow API only — do not expose ipcRenderer. */
contextBridge.exposeInMainWorld("electronDesktop", {
  isDesktop: true as const,
  notify: (payload: DesktopNotifyPayload) =>
    ipcRenderer.invoke("desktop:notify", payload) as Promise<boolean>,
  retryLoad: () => ipcRenderer.invoke("desktop:retry-load") as Promise<void>,
})
