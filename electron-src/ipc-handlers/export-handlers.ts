import { ipcMain } from "electron"
import { exportGradingDataExcel } from "../lib/prisma/excelExport"
import {
  createPdfFromRenderedImages,
  getPdfExportData,
} from "../lib/prisma/pdfExport"

import { BrowserWindow } from "electron"

export function setupExportHandlers(): void {
  // Excel Export handlers
  ipcMain.handle(
    "export-grading-data-excel",
    async (
      _event,
      options: {
        projectId: string
        selectedStudentIds: string[]
        outputPath?: string
      },
    ) => {
      try {
        return await exportGradingDataExcel(options)
      } catch (err) {
        console.error("Error exporting grading data Excel:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    },
  )

  // Canvas描画用PDF出力データ取得
  ipcMain.handle(
    "export:getPdfExportData",
    async (
      _event,
      options: {
        projectId: string
        selectedStudentIds: string[]
      },
    ) => {
      try {
        return await getPdfExportData(options)
      } catch (err) {
        console.error("Error getting PDF export data:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    },
  )

  // Canvas描画済み画像からPDF作成
  ipcMain.handle(
    "export:createPdfFromRenderedImages",
    async (
      event,
      options: {
        projectId: string
        renderedPages: Array<{
          studentId: string
          pageNumber: number
          imageData: ArrayBuffer
        }>
        pdfOrientation?: "portrait" | "landscape"
      },
    ) => {
      try {
        // プログレスコールバックを設定
        const progressCallback = (progress: {
          current: number
          total: number
          step: string
          percentage: number
          currentStepIndex: number
          totalSteps: number
        }) => {
          event.sender.send("export-progress", progress)
        }

        return await createPdfFromRenderedImages({
          ...options,
          progressCallback,
        })
      } catch (err) {
        console.error("Error creating PDF from rendered images:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    },
  )

  // PDF保存先選択ダイアログ（Canvas描画前に呼び出す）
  ipcMain.handle(
    "export:selectPdfSavePath",
    async (
      _event,
      options: {
        projectName?: string
      },
    ): Promise<{ success: boolean; filePath?: string; canceled?: boolean }> => {
      try {
        const { dialog } = require("electron")
        const dateStr = new Date().toISOString().split("T")[0]
        const safeProjectName = options.projectName
          ? options.projectName.replace(/[<>:"/\\|?*]/g, "_")
          : null
        const defaultFileName = safeProjectName
          ? `採点済み答案_${safeProjectName}_${dateStr}.pdf`
          : `採点済み答案_${dateStr}.pdf`

        const result = await dialog.showSaveDialog({
          title: "採点済み答案PDFの保存先",
          defaultPath: defaultFileName,
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }

        return { success: true, filePath: result.filePath }
      } catch (err) {
        console.error("Error selecting PDF save path:", err)
        return {
          success: false,
          canceled: false,
        }
      }
    },
  )

  // SVG→PNG変換ハンドラ（MathJaxテキストのtaint問題回避用）
  ipcMain.handle(
    "export:convertSvgToPng",
    async (
      _event,
      options: {
        svgString: string
        width?: number
        height?: number
      },
    ): Promise<{
      success: boolean
      dataUrl?: string
      width?: number
      height?: number
      error?: string
    }> => {
      try {
        const { svgString } = options

        const widthMatch = svgString.match(/width="([\d.]+)"/)
        const heightMatch = svgString.match(/height="([\d.]+)"/)
        const width = widthMatch ? Math.ceil(parseFloat(widthMatch[1])) : 200
        const height = heightMatch ? Math.ceil(parseFloat(heightMatch[1])) : 50

        const win = new BrowserWindow({
          width: width + 20,
          height: height + 20,
          show: false,
          transparent: true,
          frame: false,
          hasShadow: false,
          webPreferences: {
            offscreen: true,
          },
        })

        try {
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                * { margin: 0; padding: 0; }
                html, body { background: transparent; overflow: hidden; }
              </style>
            </head>
            <body>
              ${svgString}
            </body>
            </html>
          `
          const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
          await win.loadURL(dataUri)

          await new Promise((resolve) => setTimeout(resolve, 100))

          // capturePageはRetinaで2倍のピクセル数を返すため、論理サイズも返す
          const image = await win.webContents.capturePage({
            x: 0,
            y: 0,
            width,
            height,
          })
          const pngBuffer = image.toPNG()
          const base64 = pngBuffer.toString("base64")
          const dataUrl = `data:image/png;base64,${base64}`

          return {
            success: true,
            dataUrl,
            width,
            height,
          }
        } finally {
          win.destroy()
        }
      } catch (err) {
        console.error("Error converting SVG to PNG:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    },
  )
}
