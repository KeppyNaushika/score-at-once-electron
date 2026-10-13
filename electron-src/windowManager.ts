import type { Event, IncomingMessage, RenderProcessGoneDetails } from "electron"
import { app, BrowserWindow, Menu, shell } from "electron"
import * as path from "path"

import { isSourceRepositoryUrl } from "./lib/sourceRepository"
import menu from "./menu"
import { rendererOrigin } from "./rendererPort"

// Electron公式推奨の環境判定方法
const isDev = !app.isPackaged

/** メインウィンドウを作成し、画面のサーバーの準備完了後にURLを読み込んで表示する */
export function createMainWindow(): BrowserWindow {
  // アイコンのパスを設定（プラットフォーム別）
  const getIconPath = () => {
    if (process.platform === "darwin") {
      // macOSの場合は.icnsファイルを使用
      return isDev
        ? path.join(__dirname, "../public/icons/icon.icns")
        : path.join(process.resourcesPath, "app.asar/public/icons/icon.icns")
    } else {
      // Windows/Linuxの場合はPNGファイルを使用
      return isDev
        ? path.join(__dirname, "../public/icons/icon-win.png")
        : path.join(process.resourcesPath, "app.asar/public/icons/icon-win.png")
    }
  }

  const iconPath = getIconPath()

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 最初は非表示
    icon: iconPath, // アイコンを設定
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // 既定でも有効だが、既定に頼らず明示する（preload は scripts/buildPreload.js で1ファイルに束ねてある）
      sandbox: true,
      webSecurity: true, // セキュリティ有効化（ローカルファイルアクセスはappimg://プロトコルで対応）
      webviewTag: false,
      backgroundThrottling: false,
    },
  })

  const url = rendererOrigin

  Menu.setApplicationMenu(menu(app, mainWindow, "home"))

  restrictNavigation(mainWindow)

  // DevToolsは手動で開く（自動開放はクラッシュの原因）
  // 必要な場合: mainWindow.webContents.openDevTools()
  if (isDev && process.env.ENABLE_DEVTOOLS === "true") {
    mainWindow.webContents.openDevTools()
  }

  // webContentsのクラッシュイベントをキャッチ
  mainWindow.webContents.on(
    "render-process-gone",
    (_event: Event, details: RenderProcessGoneDetails) => {
      console.error("❌ Render process gone:", details)
    }
  )

  mainWindow.webContents.on("unresponsive", () => {
    console.error("❌ WebContents became unresponsive")
  })

  mainWindow.webContents.on("responsive", () => {
    // WebContents recovered from unresponsive state
  })

  // Windowsでは即座にウィンドウを表示（デバッグ用）
  if (process.platform === "win32") {
    setTimeout(() => {
      mainWindow.show()
    }, 2000)
  }

  // 画面のサーバー（開発時は next dev、パッケージ版は rendererStaticServer）が起動するまで待機してからURLを読み込み
  const loadWhenReady = async () => {
    const maxAttempts = 30 // 30秒間試行
    let attempts = 0

    const checkServer = async (): Promise<boolean> => {
      try {
        const { net } = require("electron")
        const request = net.request(url)

        return new Promise((resolve) => {
          request.on("response", (response: IncomingMessage) => {
            resolve(response.statusCode === 200)
          })
          request.on("error", () => {
            resolve(false)
          })
          request.end()
        })
      } catch {
        return false
      }
    }

    const waitForServer = async (): Promise<void> => {
      while (attempts < maxAttempts) {
        if (await checkServer()) {
          mainWindow.webContents.once(
            "did-fail-load",
            (_event, errorCode, errorDescription) => {
              console.error("❌ Failed to load URL:", {
                errorCode,
                errorDescription,
              })
            }
          )

          try {
            await mainWindow.loadURL(url)

            // 少し遅延を追加してから表示
            setTimeout(() => {
              mainWindow.show()
            }, 1000)
          } catch (error) {
            console.error("❌ Error during loadURL:", error)
            throw error
          }

          return
        }

        attempts++
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      console.error("Renderer server failed to start within 30 seconds")
      // サーバーが起動しない場合でもウィンドウを表示
      mainWindow.show()
    }

    waitForServer()
  }

  // 非同期でサーバー待機を開始
  loadWhenReady()

  return mainWindow
}

/** URL がアプリの画面（開発時は next dev、パッケージ版は同梱サーバー）のものか */
function isAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === new URL(rendererOrigin).origin
  } catch {
    return false
  }
}

/**
 * 画面がアプリの外へ出ないようにする。
 * - 新しいウィンドウは開かない。アプリは `window.open` を使っておらず、外部のページは
 *   main が持つ URL だけを main から既定のブラウザで開く（`aiProvider:openTermsLink`）。
 *   画面から届く任意の URL を外へ渡すと、それ自体が抜け道になるので回さない。
 *   例外は、package.json に書いたソースの在りか（「一括採点について」のリンク）だけで、
 *   これは窓を開かずに既定のブラウザで開く（`isSourceRepositoryUrl`）
 * - アプリの画面以外への遷移は止める（preload を持った窓に外のページを読ませない）
 */
function restrictNavigation(mainWindow: BrowserWindow): void {
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 窓は開かない。ソースの在りかなら、確かめてから既定のブラウザで開く
    void isSourceRepositoryUrl(url).then((isSourceRepository) => {
      if (isSourceRepository) {
        void shell.openExternal(url)
        return
      }
      console.warn("新しいウィンドウを開く要求を断りました:", url)
    })
    return { action: "deny" }
  })
  const blockForeignNavigation = (event: Event, url: string) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    console.warn("アプリの外への遷移を止めました:", url)
  }
  mainWindow.webContents.on("will-navigate", (event) =>
    blockForeignNavigation(event, event.url)
  )
  mainWindow.webContents.on("will-redirect", (event) =>
    blockForeignNavigation(event, event.url)
  )
  mainWindow.webContents.on("will-attach-webview", (event) =>
    event.preventDefault()
  )
}

/** ウィンドウのフォーカス・ブラー時のイベントハンドラを設定する（ブラー時にforce-saveを送信） */
export function setupWindowEvents(mainWindow: BrowserWindow): void {
  // アプリケーションフォーカス監視でバックグラウンド処理対策
  app.on("browser-window-focus", () => {
    // アプリがアクティブになった時の処理
  })

  app.on("browser-window-blur", () => {
    // 重要な保存処理を強制実行
    mainWindow.webContents.send("force-save")
  })
}
