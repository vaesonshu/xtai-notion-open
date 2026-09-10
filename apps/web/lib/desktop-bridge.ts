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

/** True when the UI runs inside the Electron desktop shell (not a normal browser tab). */
export function isDesktopClient(): boolean {
  return getDesktopBridge()?.isDesktop === true
}
