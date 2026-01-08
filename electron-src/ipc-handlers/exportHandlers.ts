import { BrowserWindow, dialog, ipcMain } from "electron"
import type { GetIndividualReportDataOptions } from "../lib/export/individual-report"
import {
  fetchIndividualReportData,
  fetchSubtotalGroupsForReport,
} from "../lib/export/individual-report"
import { exportGradingDataExcel } from "../lib/prisma/excelExport"
import {
  addPageToStreamingSession,
  cancelStreamingSession,
  createPdfFromRenderedImages,
  createPdfStreamingSession,
  finalizeStreamingSession,
  getPdfExportData,
} from "../lib/prisma/pdfExport"

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
      }
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
    }
  )

  // Canvas描画用PDF出力データ取得
  ipcMain.handle(
    "export:getPdfExportData",
    async (
      _event,
      options: {
        projectId: string
        selectedStudentIds: string[]
      }
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
    }
  )

  // Canvas描画済み画像からPDF作成
  ipcMain.handle(
    "export:createPdfFromRenderedImages",
    async (
      _event,
      options: {
        projectId: string
        renderedPages: Array<{
          studentId: string
          pageNumber: number
          imageData: ArrayBuffer
        }>
        pdfOrientation?: "portrait" | "landscape"
      }
    ) => {
      try {
        // プログレスコールバックは渡さない（React側で管理するため）
        // Electron側のprogressCallbackはReact側のプログレス更新と競合し、
        // プログレスバーが0%にリセットされて2周するように見える問題を引き起こしていた
        return await createPdfFromRenderedImages({
          ...options,
        })
      } catch (err) {
        console.error("Error creating PDF from rendered images:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    }
  )

  // PDF保存先選択ダイアログ（Canvas描画前に呼び出す）
  ipcMain.handle(
    "export:selectPdfSavePath",
    async (
      _event,
      options: {
        projectName?: string
      }
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
    }
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
      }
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
    }
  )

  // ============================================================
  // ストリーミングPDF生成API
  // ============================================================

  // ストリーミングセッション作成
  ipcMain.handle(
    "export:createPdfStreamingSession",
    async (
      _event,
      options: {
        totalPages: number
        pdfOrientation?: "portrait" | "landscape"
      }
    ) => {
      try {
        return await createPdfStreamingSession(options)
      } catch (err) {
        console.error("Error creating PDF streaming session:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    }
  )

  // ストリーミングセッションにページを追加
  ipcMain.handle(
    "export:addPageToStreamingSession",
    async (
      _event,
      options: {
        sessionId: string
        pageIndex: number
        imageData: ArrayBuffer
      }
    ) => {
      try {
        return await addPageToStreamingSession(options)
      } catch (err) {
        console.error("Error adding page to streaming session:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    }
  )

  // ストリーミングセッションを完了してPDF保存
  ipcMain.handle(
    "export:finalizeStreamingSession",
    async (
      _event,
      options: {
        sessionId: string
        outputPath: string
      }
    ) => {
      try {
        return await finalizeStreamingSession(options)
      } catch (err) {
        console.error("Error finalizing streaming session:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    }
  )

  // ストリーミングセッションをキャンセル
  ipcMain.handle(
    "export:cancelStreamingSession",
    async (_event, sessionId: string) => {
      try {
        cancelStreamingSession(sessionId)
        return { success: true }
      } catch (err) {
        console.error("Error canceling streaming session:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    }
  )

  // ============================================================
  // 個人成績表PDF API
  // ============================================================

  // 個人成績表用データ取得
  ipcMain.handle(
    "export:getIndividualReportData",
    async (_event, options: GetIndividualReportDataOptions) => {
      try {
        return await fetchIndividualReportData(options)
      } catch (err) {
        console.error("Error getting individual report data:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    }
  )

  // 個人成績表用小計点グループ一覧取得
  ipcMain.handle(
    "export:getSubtotalGroupsForReport",
    async (_event, projectId: string) => {
      try {
        return await fetchSubtotalGroupsForReport(projectId)
      } catch (err) {
        console.error("Error getting subtotal groups for report:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        }
      }
    }
  )

  // 個人成績表PDF保存先選択ダイアログ
  ipcMain.handle(
    "export:selectIndividualReportSavePath",
    async (
      _event,
      options: {
        projectName?: string
      }
    ): Promise<{ success: boolean; filePath?: string; canceled?: boolean }> => {
      try {
        const dateStr = new Date().toISOString().split("T")[0]
        const safeProjectName = options.projectName
          ? options.projectName.replace(/[<>:"/\\|?*]/g, "_")
          : null
        const defaultFileName = safeProjectName
          ? `個人成績表_${safeProjectName}_${dateStr}.pdf`
          : `個人成績表_${dateStr}.pdf`

        const result = await dialog.showSaveDialog({
          title: "個人成績表PDFの保存先",
          defaultPath: defaultFileName,
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }

        return { success: true, filePath: result.filePath }
      } catch (err) {
        console.error("Error selecting individual report save path:", err)
        return {
          success: false,
          canceled: false,
        }
      }
    }
  )

  // 個人成績表PDFバッファを保存
  ipcMain.handle(
    "export:saveIndividualReportPdf",
    async (
      _event,
      options: {
        filePath: string
        pdfBuffer: ArrayBuffer
      }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const fs = require("fs").promises
        await fs.writeFile(options.filePath, Buffer.from(options.pdfBuffer))
        return { success: true }
      } catch (err) {
        console.error("Error saving individual report PDF:", err)
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "ファイル保存に失敗しました",
        }
      }
    }
  )

  // HTMLからPDFを生成（ブラウザ印刷機能を使用）
  ipcMain.handle(
    "export:printHtmlToPdf",
    async (
      _event,
      options: {
        html: string
        filePath: string
        pageSize?: "A4" | "Letter"
        landscape?: boolean
        margins?: {
          top?: number
          bottom?: number
          left?: number
          right?: number
        }
      }
    ): Promise<{ success: boolean; error?: string }> => {
      const fs = require("fs").promises
      const path = require("path")
      const { app } = require("electron")

      // 一時ファイルにHTMLを書き込む（data URIは長すぎると失敗するため）
      const tempDir = app.getPath("temp")
      const tempHtmlPath = path.join(tempDir, `report-${Date.now()}.html`)

      const win = new BrowserWindow({
        width: 794, // A4 at 96 DPI
        height: 1123,
        show: false,
        webPreferences: {
          offscreen: true,
        },
      })

      try {
        // HTMLを一時ファイルに書き込み
        await fs.writeFile(tempHtmlPath, options.html, "utf-8")

        // 一時HTMLファイルをロード
        await win.loadFile(tempHtmlPath)

        // レンダリング完了を待つ
        await new Promise((resolve) => setTimeout(resolve, 500))

        // PDFを生成（マージンはインチ単位、デフォルト5mm ≈ 0.2インチ）
        const margins = options.margins || {}
        const pdfBuffer = await win.webContents.printToPDF({
          pageSize: options.pageSize || "A4",
          landscape: options.landscape || false,
          printBackground: true,
          margins: {
            marginType: "custom",
            top: margins.top ?? 0.2,
            bottom: margins.bottom ?? 0.2,
            left: margins.left ?? 0.2,
            right: margins.right ?? 0.2,
          },
        })

        // ファイルに保存
        await fs.writeFile(options.filePath, pdfBuffer)

        return { success: true }
      } catch (err) {
        console.error("Error printing HTML to PDF:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "PDF生成に失敗しました",
        }
      } finally {
        win.destroy()
        // 一時ファイルを削除
        try {
          await fs.unlink(tempHtmlPath)
        } catch {
          // 削除に失敗しても無視
        }
      }
    }
  )

  // 複数のHTMLページからPDFを生成（バッチ処理）
  ipcMain.handle(
    "export:printMultipleHtmlToPdf",
    async (
      _event,
      options: {
        htmlPages: string[]
        filePath: string
        pageSize?: "A4" | "Letter"
        landscape?: boolean
        onProgress?: (current: number, total: number) => void
      }
    ): Promise<{ success: boolean; error?: string }> => {
      const win = new BrowserWindow({
        width: 794,
        height: 1123,
        show: false,
        webPreferences: {
          offscreen: true,
        },
      })

      try {
        // 全ページを1つのHTMLに結合（ページ区切り付き）
        const combinedHtml = `
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: A4; margin: 5mm; }
              .page-break { page-break-after: always; }
              .page-break:last-child { page-break-after: auto; }
            </style>
          </head>
          <body>
            ${options.htmlPages
              .map(
                (html, index) => `
              <div class="${index < options.htmlPages.length - 1 ? "page-break" : ""}">
                ${html}
              </div>
            `
              )
              .join("")}
          </body>
          </html>
        `

        const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(combinedHtml)}`
        await win.loadURL(dataUri)

        // レンダリング完了を待つ
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // PDFを生成（マージンはインチ単位、5mm ≈ 0.2インチ）
        const pdfBuffer = await win.webContents.printToPDF({
          pageSize: options.pageSize || "A4",
          landscape: options.landscape || false,
          printBackground: true,
          margins: {
            marginType: "custom",
            top: 0.2,
            bottom: 0.2,
            left: 0.2,
            right: 0.2,
          },
        })

        // ファイルに保存
        const fs = require("fs").promises
        await fs.writeFile(options.filePath, pdfBuffer)

        return { success: true }
      } catch (err) {
        console.error("Error printing multiple HTML to PDF:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "PDF生成に失敗しました",
        }
      } finally {
        win.destroy()
      }
    }
  )

  // ============================================================
  // 印刷ダイアログを表示するAPI
  // ============================================================

  // HTMLからPDFを生成してプレビューで開く
  ipcMain.handle(
    "export:openPrintDialog",
    async (
      _event,
      options: {
        html: string
        title?: string
      }
    ): Promise<{ success: boolean; error?: string }> => {
      const fs = require("fs").promises
      const path = require("path")
      const { app, shell } = require("electron")

      const tempDir = app.getPath("temp")
      const tempHtmlPath = path.join(tempDir, `print-${Date.now()}.html`)
      const tempPdfPath = path.join(
        tempDir,
        `${options.title || "個人成績表"}-${Date.now()}.pdf`
      )

      const win = new BrowserWindow({
        width: 794, // A4 at 96 DPI
        height: 1123,
        show: false,
        webPreferences: {
          offscreen: true,
        },
      })

      try {
        // HTMLを一時ファイルに書き込み
        await fs.writeFile(tempHtmlPath, options.html, "utf-8")

        // 一時HTMLファイルをロード
        await win.loadFile(tempHtmlPath)

        // レンダリング完了を待つ
        await new Promise((resolve) => setTimeout(resolve, 500))

        // PDFを生成（マージンはインチ単位、5mm ≈ 0.2インチ）
        const pdfBuffer = await win.webContents.printToPDF({
          pageSize: "A4",
          landscape: false,
          printBackground: true,
          margins: {
            marginType: "custom",
            top: 0.2,
            bottom: 0.2,
            left: 0.2,
            right: 0.2,
          },
        })

        // PDFを一時ファイルに保存
        await fs.writeFile(tempPdfPath, pdfBuffer)

        // プレビュー.appで開く（ユーザーがそこから印刷・保存可能）
        await shell.openPath(tempPdfPath)

        return { success: true }
      } catch (err) {
        console.error("Error generating PDF:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "PDF生成に失敗しました",
        }
      } finally {
        win.destroy()
        // HTMLの一時ファイルを削除
        try {
          await fs.unlink(tempHtmlPath)
        } catch {
          // 削除に失敗しても無視
        }
        // PDFは開いているので削除しない（ユーザーが保存する可能性がある）
      }
    }
  )
}
