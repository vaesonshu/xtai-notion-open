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

export {}
