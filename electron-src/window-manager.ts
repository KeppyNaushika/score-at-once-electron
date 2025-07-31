import { join } from "path"
import { BrowserWindow, app, Menu } from "electron"
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

  // DevToolsは手動で開く（自動開放はクラッシュの原因）
  // 必要な場合: mainWindow.webContents.openDevTools()
  if (isDev && process.env.ENABLE_DEVTOOLS === 'true') {
    mainWindow.webContents.openDevTools()
  }

  console.log("Main window created, waiting for Next.js server...")
  
  // webContentsのクラッシュイベントをキャッチ
  mainWindow.webContents.on('render-process-gone', (event: any, details: any) => {
    console.error('❌ Render process gone:', details)
  })
  
  mainWindow.webContents.on('unresponsive', () => {
    console.error('❌ WebContents became unresponsive')
  })
  
  mainWindow.webContents.on('responsive', () => {
    console.log('✅ WebContents became responsive again')
  })
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page finished loading')
  })
  
  mainWindow.webContents.on('dom-ready', () => {
    console.log('✅ DOM ready')
  })
  
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
          
          // より詳細なロードイベントを監視
          mainWindow.webContents.once('did-start-loading', () => {
            console.log('🔄 Started loading URL')
          })
          
          mainWindow.webContents.once('did-stop-loading', () => {
            console.log('⏹ Stopped loading URL')
          })
          
          mainWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('❌ Failed to load URL:', { errorCode, errorDescription })
          })
          
          try {
            await mainWindow.loadURL(url)
            console.log("✅ loadURL completed successfully")
            
            // 少し遅延を追加してから表示
            setTimeout(() => {
              mainWindow.show()
              console.log("Main window displayed")
            }, 1000)
          } catch (error) {
            console.error("❌ Error during loadURL:", error)
            throw error
          }
          
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
