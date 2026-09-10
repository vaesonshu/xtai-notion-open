import path from "node:path"
import started from "electron-squirrel-startup"
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  Tray,
  nativeImage,
  shell,
  type MenuItemConstructorOptions,
} from "electron"
import {
  startCodexBridgeHost,
  stopCodexBridgeHost,
} from "./lib/codex-bridge-host"
import { sanitizeNotifyPayload } from "./lib/notify"
import { shouldHideOnClose } from "./lib/window-policy"
import {
  DEV_WEB_URL,
  assertHttpsAppUrl,
  getAllowedOrigins,
  getAppLoadUrl,
  isAllowedNavigationUrl,
  resolveWindowOpenAction,
} from "./lib/urls"

if (started) {
  app.quit()
}

app.setAppUserModelId("com.xtai.notion.desktop")

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let tray: Tray | null = null

const TRAY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR4nGP4z8BQDwAEgQGAhKmMIQAAAABJRU5ErkJggg=="

function packagedAppUrl(): string {
  if (!app.isPackaged) return ""
  return assertHttpsAppUrl(__XT_DESKTOP_APP_URL__)
}

function preloadPath(): string {
  return path.join(__dirname, "preload.js")
}

function allowedOrigins(): string[] {
  const packaged = packagedAppUrl()
  return getAllowedOrigins({
    isPackaged: app.isPackaged,
    packagedAppUrl: packaged || DEV_WEB_URL,
    viteDevServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  })
}

function attachNavigationGuards(win: BrowserWindow): void {
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url, allowedOrigins())) {
      event.preventDefault()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    const action = resolveWindowOpenAction(url, allowedOrigins())
    if (action === "load-in-window") {
      void win.loadURL(url)
    } else if (action === "open-external") {
      void shell.openExternal(url)
    }
    return { action: "deny" }
  })
}

async function loadOffline(win: BrowserWindow): Promise<void> {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    return
  }
  await win.loadFile(
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  )
}

async function loadApp(win: BrowserWindow): Promise<void> {
  const url = getAppLoadUrl(app.isPackaged, packagedAppUrl())
  await win.loadURL(url)
}

/** One path to offline UI — avoids did-fail-load + catch racing loadURL. */
function loadAppOrOffline(win: BrowserWindow): void {
  void loadApp(win).catch(() => {
    void loadOffline(win).catch(() => undefined)
  })
}

function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function quitApp(): void {
  isQuitting = true
  void stopCodexBridgeHost()
  app.quit()
}

function showTestNotification(): void {
  void showNotification({
    title: "XtAi Notion",
    body: "这是一条测试通知",
  })
}

function showNotification(payload: unknown): boolean {
  const clean = sanitizeNotifyPayload(payload)
  if (!clean || !Notification.isSupported()) return false
  try {
    const notification = new Notification({
      title: clean.title,
      body: clean.body,
    })
    notification.on("click", () => showMainWindow())
    notification.show()
    return true
  } catch {
    return false
  }
}

function buildAppMenu(): Menu {
  const viewChildren: MenuItemConstructorOptions[] = [
    { role: "reload", label: "重新加载" },
  ]
  if (!app.isPackaged) {
    viewChildren.push({ role: "toggleDevTools", label: "开发者工具" })
  }
  return Menu.buildFromTemplate([
    {
      label: "文件",
      submenu: [
        { label: "显示主窗口", click: () => showMainWindow() },
        { type: "separator" },
        { label: "退出", click: () => quitApp() },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    { label: "视图", submenu: viewChildren },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { label: "显示", click: () => showMainWindow() },
      ],
    },
    {
      label: "帮助",
      submenu: [{ label: "测试通知", click: () => showTestNotification() }],
    },
  ])
}

function createTray(): Tray {
  const icon = nativeImage.createFromDataURL(TRAY_PNG)
  const nextTray = new Tray(icon)
  nextTray.setToolTip("XtAi Notion")
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示主窗口", click: () => showMainWindow() },
      { label: "退出", click: () => quitApp() },
    ])
  )
  nextTray.on("click", () => showMainWindow())
  return nextTray
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  attachNavigationGuards(win)

  win.on("close", (event) => {
    if (!shouldHideOnClose(isQuitting)) return
    event.preventDefault()
    win.hide()
  })

  loadAppOrOffline(win)
  return win
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    showMainWindow()
  })
}

app.on("window-all-closed", () => {
  // Tray keeps the process alive on Windows.
})

app.whenReady().then(async () => {
  await startCodexBridgeHost({ packagedAppUrl: packagedAppUrl() })
  Menu.setApplicationMenu(buildAppMenu())
  tray = createTray()
  ipcMain.handle("desktop:retry-load", async () => {
    if (mainWindow) loadAppOrOffline(mainWindow)
  })
  ipcMain.handle("desktop:notify", async (_event, payload: unknown) =>
    showNotification(payload)
  )
  mainWindow = createWindow()
})
