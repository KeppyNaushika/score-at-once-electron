import { join } from "path"
import { BrowserWindow, app, Menu, nativeImage } from "electron"
import menu from "./menu"

// Electron公式推奨の環境判定方法
const isDev = !app.isPackaged

export function createMainWindow(): BrowserWindow {
  // アイコンのパスを設定
  const iconPath = isDev 
    ? join(__dirname, "../public/一括採点アイコン.png")
    : join(process.resourcesPath, "app.asar/public/一括採点アイコン.png")
  
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 最初は非表示
    icon: iconPath, // アイコンを設定
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
  })

  const url = "http://localhost:3000"

  Menu.setApplicationMenu(menu(app, mainWindow, "home"))

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  console.log("Main window created, waiting for Next.js server...")
  
  // Windowsでは即座にウィンドウを表示（デバッグ用）
  if (process.platform === "win32") {
    setTimeout(() => {
      console.log("Showing window immediately for Windows debugging")
      mainWindow.show()
    }, 2000)
  }
  
  // Next.jsサーバーが起動するまで待機してからURLを読み込み
  const loadWhenReady = async () => {
    const maxAttempts = 30 // 30秒間試行
    let attempts = 0
    
    const checkServer = async (): Promise<boolean> => {
      try {
        const { net } = require('electron')
        const request = net.request(url)
        
        return new Promise((resolve) => {
          request.on('response', (response: any) => {
            resolve(response.statusCode === 200)
          })
          request.on('error', () => {
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
        console.log(`Checking Next.js server... attempt ${attempts + 1}/${maxAttempts}`)
        
        if (await checkServer()) {
          console.log("Next.js server is ready, loading URL...")
          await mainWindow.loadURL(url)
          mainWindow.show() // サーバー準備完了後にウィンドウを表示
          console.log("Main window displayed")
          return
        }
        
        attempts++
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      console.error("Next.js server failed to start within 30 seconds")
      // サーバーが起動しない場合でもウィンドウを表示
      mainWindow.show()
    }
    
    waitForServer()
  }

  // 非同期でサーバー待機を開始
  loadWhenReady()

  return mainWindow
}

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
