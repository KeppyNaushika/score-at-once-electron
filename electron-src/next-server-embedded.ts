import { join } from "path"
import { app } from "electron"

// Electron公式推奨の環境判定方法
const isDev = !app.isPackaged

let nextApp: any = null
let httpServer: any = null

export async function startEmbeddedNextServer(): Promise<void> {
  if (isDev) return // 開発時は外部サーバーを使用

  try {
    const next = require('next')
    const { createServer } = require('http')
    
    const hostname = 'localhost'
    const port = 3000
    
    // Next.jsアプリの初期化
    let appDir
    if (process.resourcesPath) {
      // パッケージ化されている場合、まずextraResourcesディレクトリをチェック
      const extraResourceDir = join(process.resourcesPath, '..')
      const asarUnpackedDir = join(process.resourcesPath, 'app.asar.unpacked')
      
      console.log(`Checking extraResource directory: ${extraResourceDir}`)
      console.log(`Checking asar.unpacked directory: ${asarUnpackedDir}`)
      
      // extraResourcesに.nextがあるかチェック
      const extraResourceNextDir = join(extraResourceDir, '.next')
      const asarUnpackedNextDir = join(asarUnpackedDir, '.next')
      
      // .nextディレクトリの存在確認
      try {
        const fs = require('fs')
        console.log(`Checking if ${extraResourceNextDir} exists: ${fs.existsSync(extraResourceNextDir)}`)
        console.log(`Checking if ${asarUnpackedNextDir} exists: ${fs.existsSync(asarUnpackedNextDir)}`)
        
        if (fs.existsSync(extraResourceNextDir)) {
          appDir = extraResourceDir
          console.log(`✓ Using extraResource Next.js app directory: ${appDir}`)
        } else if (fs.existsSync(asarUnpackedNextDir)) {
          appDir = asarUnpackedDir
          console.log(`✓ Using asar.unpacked Next.js app directory: ${appDir}`)
        } else {
          // フォールバック: extraResourceディレクトリを使用
          appDir = extraResourceDir
          console.log(`⚠ Fallback to extraResource directory: ${appDir}`)
          console.log(`⚠ Warning: No .next directory found in expected locations`)
        }
      } catch (error) {
        console.error(`❌ Error checking .next directories:`, error)
        appDir = extraResourceDir
        console.log(`❌ Error fallback to extraResource directory: ${appDir}`)
      }
    } else {
      // 開発環境の場合
      appDir = process.cwd()
      console.log(`Development Next.js app directory: ${appDir}`)
    }
    
    nextApp = next({ 
      dev: false, 
      hostname, 
      port,
      dir: appDir
    })
    
    const handle = nextApp.getRequestHandler()
    
    await nextApp.prepare()
    
    httpServer = createServer(async (req: any, res: any) => {
      try {
        await handle(req, res)
      } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
      }
    })
    
    return new Promise((resolve, reject) => {
      httpServer.listen(port, hostname, (err: any) => {
        if (err) {
          console.error('Failed to start Next.js server:', err)
          reject(err)
        } else {
          console.log(`✓ Next.js server started successfully on http://${hostname}:${port}`)
          console.log('Next.js server is now ready to accept connections')
          resolve()
        }
      })
    })
  } catch (error) {
    console.error('Error starting embedded Next.js server:', error)
    throw error
  }
}

export function stopEmbeddedNextServer(): void {
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }
  if (nextApp) {
    nextApp = null
  }
}