import { BrowserWindow, dialog, ipcMain } from "electron"

import { fetchExportData } from "../lib/export/excel/dataFetcher"
import type { GetIndividualReportDataOptions } from "../lib/export/individual-report"
import {
  fetchIndividualReportData,
  fetchSubtotalGroupsForReport,
} from "../lib/export/individual-report"
import {
  exportRData,
  type ExportRDataOptions,
} from "../lib/export/r-exametrika/rDataExporter"
import { resolveMathJaxSrc, waitForRendering } from "../lib/printUtils"
import { exportGradingDataExcel } from "../lib/prisma/excelExport"
import {
  addPageToStreamingSession,
  cancelStreamingSession,
  createPdfFromRenderedImages,
  createPdfStreamingSession,
  finalizeStreamingSession,
  getPdfExportData,
} from "../lib/prisma/pdfExport"
import {
  captureReturnSnapshot,
  getReturnDiff,
} from "../lib/prisma/returnSnapshot"
import {
  buildConflictIdentifiers,
  validateScoringData,
} from "../lib/shared/utilities/validateScoringData"
import { registerSafeHandler } from "./ipcHandlerUtils"

// ============================================================
// SVG→PNG変換用の共有オフスクリーンウィンドウ
// ------------------------------------------------------------
// テキスト要素ごとにBrowserWindowを生成・破棄すると、並列レンダリング時に
// オフスクリーン合成サーフェスの確保やcapturePageが間欠的に失敗する。
// 単一ウィンドウを使い回し、変換要求を直列化することで安定化・高速化する。
// ============================================================

/** 使い回す共有オフスクリーンウィンドウ */
let sharedSvgWindow: BrowserWindow | null = null

/** 変換要求を直列化するためのキュー */
let svgConvertChain: Promise<unknown> = Promise.resolve()

/** 進行中の変換要求数（0になったらアイドル破棄を予約する） */
let pendingSvgConversions = 0

/** アイドル時に共有ウィンドウを破棄するタイマー */
let svgWindowIdleTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 変換が一定時間来なければ共有ウィンドウを破棄するまでの待機時間。
 * 隠しウィンドウが常駐し続けると window-all-closed が発火せずアプリが終了
 * できなくなるため、エクスポートのバースト終了後は速やかに解放する。
 */
const SVG_WINDOW_IDLE_MS = 5000

/**
 * loadURL / capturePage 1回あたりのタイムアウト。
 * オフスクリーンGPUのストールでチェーンが永久ブロックするのを防ぐ。
 */
const SVG_RENDER_TIMEOUT_MS = 15000

/** 共有オフスクリーンウィンドウを取得（無ければ生成） */
function getSharedSvgWindow(): BrowserWindow {
  // 利用が始まったらアイドル破棄予約を解除する
  if (svgWindowIdleTimer) {
    clearTimeout(svgWindowIdleTimer)
    svgWindowIdleTimer = null
  }
  if (sharedSvgWindow && !sharedSvgWindow.isDestroyed()) {
    return sharedSvgWindow
  }
  sharedSvgWindow = new BrowserWindow({
    width: 200,
    height: 50,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    webPreferences: {
      offscreen: true,
    },
  })
  return sharedSvgWindow
}

/**
 * 共有オフスクリーンウィンドウを破棄する。
 * アプリ終了時・変換失敗（ハング/クラッシュの疑い）時・アイドル時に呼ぶ。
 * 破棄後は次回 getSharedSvgWindow で新しいウィンドウが生成される。
 */
export function destroySharedSvgWindow(): void {
  if (svgWindowIdleTimer) {
    clearTimeout(svgWindowIdleTimer)
    svgWindowIdleTimer = null
  }
  if (sharedSvgWindow && !sharedSvgWindow.isDestroyed()) {
    sharedSvgWindow.destroy()
  }
  sharedSvgWindow = null
}

/** 変換要求が掃けたら、一定アイドル後にウィンドウを破棄するよう予約する */
function scheduleSvgWindowTeardown(): void {
  if (svgWindowIdleTimer) clearTimeout(svgWindowIdleTimer)
  svgWindowIdleTimer = setTimeout(() => {
    svgWindowIdleTimer = null
    // タイマー発火までに新たな要求が来ていないことを確認してから破棄
    if (pendingSvgConversions === 0) destroySharedSvgWindow()
  }, SVG_WINDOW_IDLE_MS)
}

/** 指定ミリ秒待機する */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Promiseにタイムアウトを付与する。期限を超えたら reject する。 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/** SVG文字列をPNGのdataURLへ変換する（共有ウィンドウを直列利用） */
async function convertSvgToPngInternal(svgString: string): Promise<{
  success: boolean
  dataUrl?: string
  width?: number
  height?: number
  error?: string
}> {
  const widthMatch = svgString.match(/width="([\d.]+)"/)
  const heightMatch = svgString.match(/height="([\d.]+)"/)
  const width = widthMatch ? Math.ceil(parseFloat(widthMatch[1])) : 200
  const height = heightMatch ? Math.ceil(parseFloat(heightMatch[1])) : 50

  const win = getSharedSvgWindow()
  win.setContentSize(width + 20, height + 20)

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

  const capture = () =>
    withTimeout(
      win.webContents.capturePage({ x: 0, y: 0, width, height }),
      SVG_RENDER_TIMEOUT_MS,
      "capturePage"
    )

  try {
    await withTimeout(win.loadURL(dataUri), SVG_RENDER_TIMEOUT_MS, "loadURL")

    // オフスクリーン描画が完了するまで待機。capturePageが空画像を返す場合は
    // 描画未完了なので短い間隔でリトライする（低速機の初回ペイント対策に
    // 最大15回 = 約600msまで待つ）。
    let image = await capture()
    for (let attempt = 0; attempt < 15 && image.isEmpty(); attempt++) {
      await delay(40)
      image = await capture()
    }

    if (image.isEmpty()) {
      // 描画リソースが壊れている可能性があるためウィンドウを作り直す
      destroySharedSvgWindow()
      return {
        success: false,
        error: `capturePage returned an empty image (${width}x${height})`,
      }
    }

    const dataUrl = `data:image/png;base64,${image.toPNG().toString("base64")}`
    return { success: true, dataUrl, width, height }
  } catch (err) {
    // ハング・GPUクラッシュした可能性があるため共有ウィンドウを破棄し、
    // 次回要求で新しいウィンドウを再生成して回復させる。
    destroySharedSvgWindow()
    throw err
  }
}

/** Excel・PDF出力・個人成績表・ストリーミングPDF生成に関するIPCチャンネルを登録する */
export function setupExportHandlers(): void {
  // 採点データバリデーション（全エクスポート共通）
  registerSafeHandler(
    "export:validateScoringData",
    async (options: { examId: string; selectedStudentIds: string[] }) => {
      const result = await fetchExportData(
        options.examId,
        options.selectedStudentIds
      )
      if (!result.success || !result.scoringData) {
        return {
          success: false,
          error: result.error || "データ取得に失敗しました",
        }
      }
      const validationResult = validateScoringData(
        result.scoringData,
        buildConflictIdentifiers(
          result.scoringData,
          result.scoreConflicts ?? []
        )
      )
      return { success: true, ...validationResult }
    }
  )

  // Excel Export handlers
  registerSafeHandler(
    "export-grading-data-excel",
    async (options: {
      examId: string
      selectedStudentIds: string[]
      outputPath?: string
    }) => {
      return await exportGradingDataExcel(options)
    }
  )

  // R / exametrika 向けデータ出力（#834）
  registerSafeHandler("export-r-data", async (options: ExportRDataOptions) => {
    return await exportRData(options)
  })

  // Excelプレビュー用データ取得
  registerSafeHandler(
    "export:getExcelPreviewData",
    async (options: { examId: string; selectedStudentIds: string[] }) => {
      const result = await fetchExportData(
        options.examId,
        options.selectedStudentIds
      )
      if (!result.success) {
        return { success: false, error: result.error }
      }
      // Prismaの Decimal/Date 型はIPC経由でcloneできないため、
      // プレーンなJSオブジェクトに変換して返す
      const questionRegions = result.questionRegions?.map((questionRegion) => ({
        id: questionRegion.id,
        label: questionRegion.label,
        points:
          questionRegion.points != null ? Number(questionRegion.points) : null,
        orderIndex:
          questionRegion.orderIndex != null
            ? Number(questionRegion.orderIndex)
            : null,
      }))

      const scoringData = result.scoringData?.map((sd) => ({
        studentId: sd.studentId,
        studentName: sd.studentName,
        studentNumber: sd.studentNumber,
        grade: sd.grade,
        className: sd.className,
        attendanceNumber:
          sd.attendanceNumber != null ? Number(sd.attendanceNumber) : null,
        status: sd.status,
        scores: sd.scores.map((score) => ({
          questionId: score.questionId,
          questionLabel: score.questionLabel,
          score: score.score != null ? Number(score.score) : null,
          maxScore: Number(score.maxScore),
          status: score.status,
        })),
        totalScore: sd.totalScore != null ? Number(sd.totalScore) : null,
        totalMaxScore: Number(sd.totalMaxScore),
        subtotalScores: sd.subtotalScores.map((subtotalScore) => ({
          subtotalId: subtotalScore.subtotalId,
          subtotalLabel: subtotalScore.subtotalLabel,
          score:
            subtotalScore.score != null ? Number(subtotalScore.score) : null,
          maxScore: Number(subtotalScore.maxScore),
        })),
      }))

      return {
        success: true,
        questionRegions,
        subtotalColumns: result.subtotalColumns,
        scoringData,
      }
    }
  )

  // Canvas描画用PDF出力データ取得
  registerSafeHandler(
    "export:getPdfExportData",
    async (options: { examId: string; selectedStudentIds: string[] }) => {
      return await getPdfExportData(options)
    }
  )

  // Canvas描画済み画像からPDF作成
  registerSafeHandler(
    "export:createPdfFromRenderedImages",
    async (options: {
      examId: string
      renderedPages: Array<{
        studentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }>
      pdfOrientation?: "portrait" | "landscape"
    }) => {
      // プログレスコールバックは渡さない（React側で管理するため）
      // Electron側のprogressCallbackはReact側のプログレス更新と競合し、
      // プログレスバーが0%にリセットされて2周するように見える問題を引き起こしていた
      return await createPdfFromRenderedImages({
        ...options,
      })
    }
  )

  // PDF保存先選択ダイアログ（Canvas描画前に呼び出す）
  registerSafeHandler(
    "export:selectPdfSavePath",
    async (options: {
      examName?: string
    }): Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
    }> => {
      const dateStr = new Date().toISOString().split("T")[0]
      const safeExamName = options.examName
        ? options.examName.replace(/[<>:"/\\|?*]/g, "_")
        : null
      const defaultFileName = safeExamName
        ? `採点済み答案_${safeExamName}_${dateStr}.pdf`
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
    }
  )

  // SVG→PNG変換ハンドラ（MathJaxテキストのtaint問題回避用）
  // NOTE: 共有オフスクリーンウィンドウ（convertSvgToPngInternal）を直列利用する。
  // 要求が並列に来ても svgConvertChain で順序化し、リソース競合を防ぐ。
  ipcMain.handle(
    "export:convertSvgToPng",
    (
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
      pendingSvgConversions++
      const run = svgConvertChain
        .then(() =>
          convertSvgToPngInternal(options.svgString).catch((err) => {
            console.error("Error in IPC handler [export:convertSvgToPng]:", err)
            return {
              success: false,
              error:
                err instanceof Error ? err.message : "Unknown error occurred",
            }
          })
        )
        .finally(() => {
          pendingSvgConversions--
          // 要求が掃けたら共有ウィンドウのアイドル破棄を予約する
          if (pendingSvgConversions === 0) scheduleSvgWindowTeardown()
        })
      // チェーンが例外で途切れないようにする（runは常にresolveするが念のため）
      svgConvertChain = run.catch(() => undefined)
      return run
    }
  )

  // ============================================================
  // ストリーミングPDF生成API
  // ============================================================

  // ストリーミングセッション作成
  registerSafeHandler(
    "export:createPdfStreamingSession",
    async (options: {
      totalPages: number
      pdfOrientation?: "portrait" | "landscape"
    }) => {
      return await createPdfStreamingSession(options)
    }
  )

  // ストリーミングセッションにページを追加
  registerSafeHandler(
    "export:addPageToStreamingSession",
    async (options: {
      sessionId: string
      pageIndex: number
      imageData: ArrayBuffer
    }) => {
      return await addPageToStreamingSession(options)
    }
  )

  // ストリーミングセッションを完了してPDF保存
  registerSafeHandler(
    "export:finalizeStreamingSession",
    async (options: { sessionId: string; outputPath: string }) => {
      return await finalizeStreamingSession(options)
    }
  )

  // ストリーミングセッションをキャンセル
  registerSafeHandler(
    "export:cancelStreamingSession",
    async (sessionId: string) => {
      cancelStreamingSession(sessionId)
      return { success: true }
    }
  )

  // ============================================================
  // 個人成績表PDF API
  // ============================================================

  // 個人成績表用データ取得
  registerSafeHandler(
    "export:getIndividualReportData",
    async (options: GetIndividualReportDataOptions) => {
      return await fetchIndividualReportData(options)
    }
  )

  // 個人成績表用小計点グループ一覧取得
  registerSafeHandler(
    "export:getSubtotalGroupsForReport",
    async (examId: string) => {
      return await fetchSubtotalGroupsForReport(examId)
    }
  )

  // 個人成績表PDF保存先選択ダイアログ
  registerSafeHandler(
    "export:selectIndividualReportSavePath",
    async (options: {
      examName?: string
    }): Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
    }> => {
      const dateStr = new Date().toISOString().split("T")[0]
      const safeExamName = options.examName
        ? options.examName.replace(/[<>:"/\\|?*]/g, "_")
        : null
      const defaultFileName = safeExamName
        ? `個人成績表_${safeExamName}_${dateStr}.pdf`
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
    }
  )

  // 個人成績表PDFバッファを保存
  registerSafeHandler(
    "export:saveIndividualReportPdf",
    async (options: {
      filePath: string
      pdfBuffer: ArrayBuffer
    }): Promise<{ success: boolean; error?: string }> => {
      const fs = require("fs").promises
      await fs.writeFile(options.filePath, Buffer.from(options.pdfBuffer))
      return { success: true }
    },
    "ファイル保存に失敗しました"
  )

  // HTMLからPDFを生成（ブラウザ印刷機能を使用）
  // NOTE: Uses BrowserWindow with try-finally for cleanup, kept as manual ipcMain.handle
  ipcMain.handle(
    "export:printHtmlToPdf",
    async (
      _event,
      options: {
        html: string
        filePath: string
        pageSize?: "A4" | "Letter" | { width: number; height: number }
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
        // MathJaxパスを解決してHTMLを一時ファイルに書き込み
        const html = resolveMathJaxSrc(options.html)
        await fs.writeFile(tempHtmlPath, html, "utf-8")

        // 一時HTMLファイルをロード
        await win.loadFile(tempHtmlPath)

        // MathJax描画完了を待つ（MathJaxがなければ500ms待機）
        await waitForRendering(win)

        // PDFを生成（マージンはインチ単位、デフォルト5mm ≈ 0.2インチ）
        const margins = options.margins || {}
        // pageSizeがmmオブジェクトの場合はインチに変換
        let resolvedPageSize:
          "A4" | "Letter" | { width: number; height: number } =
          options.pageSize || "A4"
        if (
          typeof resolvedPageSize === "object" &&
          "width" in resolvedPageSize &&
          "height" in resolvedPageSize
        ) {
          resolvedPageSize = {
            width: resolvedPageSize.width / 25.4,
            height: resolvedPageSize.height / 25.4,
          }
        }
        const pdfBuffer = await win.webContents.printToPDF({
          pageSize: resolvedPageSize,
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
        console.error("Error in IPC handler [export:printHtmlToPdf]:", err)
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
  // NOTE: Uses BrowserWindow with try-finally for cleanup, kept as manual ipcMain.handle
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
        console.error(
          "Error in IPC handler [export:printMultipleHtmlToPdf]:",
          err
        )
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
  // NOTE: Uses BrowserWindow with try-finally for cleanup, kept as manual ipcMain.handle
  ipcMain.handle(
    "export:openPrintDialog",
    async (
      _event,
      options: {
        html: string
        title?: string
        pageSize?: "A4" | "Letter" | { width: number; height: number }
        landscape?: boolean
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
        // MathJaxパスを解決してHTMLを一時ファイルに書き込み
        const html = resolveMathJaxSrc(options.html)
        await fs.writeFile(tempHtmlPath, html, "utf-8")

        // 一時HTMLファイルをロード
        await win.loadFile(tempHtmlPath)

        // MathJax描画完了を待つ（MathJaxがなければ500ms待機）
        await waitForRendering(win)

        // PDFを生成（マージンはCSSの@page marginに任せるため0に設定）
        // pageSizeがmmオブジェクトの場合はインチに変換
        let pageSize: "A4" | "Letter" | { width: number; height: number } =
          options.pageSize || "A4"
        if (
          typeof pageSize === "object" &&
          "width" in pageSize &&
          "height" in pageSize
        ) {
          pageSize = {
            width: pageSize.width / 25.4,
            height: pageSize.height / 25.4,
          }
        }

        const pdfBuffer = await win.webContents.printToPDF({
          pageSize,
          landscape: options.landscape || false,
          printBackground: true,
          margins: {
            marginType: "custom",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          },
        })

        // PDFを一時ファイルに保存
        await fs.writeFile(tempPdfPath, pdfBuffer)

        // プレビュー.appで開く（ユーザーがそこから印刷・保存可能）
        await shell.openPath(tempPdfPath)

        return { success: true }
      } catch (err) {
        console.error("Error in IPC handler [export:openPrintDialog]:", err)
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

  // 答案返却スナップショット: 現在の有効スコア＋注釈を返却版として記録する
  registerSafeHandler(
    "export:captureReturnSnapshot",
    async (options: { examId: string; studentIds: string[] }) => {
      return await captureReturnSnapshot({
        examId: options.examId,
        studentIds: options.studentIds,
      })
    }
  )

  // 返却版と現在状態の差分（変更があった生徒の検出）
  registerSafeHandler("export:getReturnDiff", async (examId: string) => {
    return await getReturnDiff(examId)
  })
}
