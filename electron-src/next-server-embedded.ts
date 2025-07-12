import { join } from "path"
import isDev from "electron-is-dev"

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
    nextApp = next({ 
      dev: false, 
      hostname, 
      port,
      dir: process.resourcesPath ? join(process.resourcesPath, 'app.asar.unpacked') : process.cwd()
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
          console.log(`> Ready on http://${hostname}:${port}`)
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