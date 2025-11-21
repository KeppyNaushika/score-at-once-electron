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
      // パッケージ化されている場合、Resourcesディレクトリを直接使用
      // forge.config.jsのextraResourceで.nextとpublicの両方がResourcesディレクトリに配置される
      appDir = process.resourcesPath

      console.log(`Using Resources directory as app directory: ${appDir}`)

      // .nextとpublicディレクトリの存在確認
      try {
        const fs = require('fs')
        const nextDir = join(appDir, '.next')
        const publicDir = join(appDir, 'public')

        console.log(`Checking if ${nextDir} exists: ${fs.existsSync(nextDir)}`)
        console.log(`Checking if ${publicDir} exists: ${fs.existsSync(publicDir)}`)

        if (!fs.existsSync(nextDir)) {
          console.warn(`⚠ Warning: .next directory not found at ${nextDir}`)
        }
        if (!fs.existsSync(publicDir)) {
          console.warn(`⚠ Warning: public directory not found at ${publicDir}`)
        }

        // PDF workerファイルの存在確認
        const pdfWorkerPath = join(publicDir, 'js', 'pdf.worker.min.mjs')
        console.log(`Checking if PDF worker exists: ${fs.existsSync(pdfWorkerPath)}`)
        if (!fs.existsSync(pdfWorkerPath)) {
          console.error(`❌ PDF worker file not found at ${pdfWorkerPath}`)
        } else {
          console.log(`✓ PDF worker file found at ${pdfWorkerPath}`)
        }
      } catch (error) {
        console.error(`❌ Error checking directories:`, error)
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