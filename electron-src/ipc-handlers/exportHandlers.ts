import { BrowserWindow, dialog } from "electron"

import type { ConflictWarning } from "@/types/exportValidation.types"

import { fetchExportData } from "../lib/export/excel/dataFetcher"
import { exportGradingDataExcel } from "../lib/export/excel/excelExportMain"
import {
  fetchIndividualReportData,
  fetchSubtotalGroupsForReport,
} from "../lib/export/individual-report/dataFetcher"
import type { GetIndividualReportDataOptions } from "../lib/export/individual-report/types"
import {
  exportRData,
  type ExportRDataOptions,
} from "../lib/export/r-exametrika/rDataExporter"
import { resolveMathJaxSrc, waitForRendering } from "../lib/printUtils"
import { recordAuditLog } from "../lib/prisma/auditLog"
import { resolveExamScope } from "../lib/prisma/auditScope"
import {
  addPageToStreamingSession,
  cancelStreamingSession,
  createPdfStreamingSession,
  finalizeStreamingSession,
  getPdfExportData,
} from "../lib/prisma/pdfExport"
import {
  captureReturnSnapshot,
  getReturnDiff,
} from "../lib/prisma/returnSnapshot"
import { getExamDecisionSummary } from "../lib/prisma/scoreDecisionSummary"
import type { StudentExportPlacement } from "../lib/shared/types"
import {
  buildConflictWarnings,
  validateScoringData,
} from "../lib/shared/utilities/validateScoringData"
import { registerHandler } from "./ipcHandlerUtils"

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

/** capturePage 前にコンポジタを温める待機時間。
 * capturePage をオフスクリーンサーフェス確保の直後に呼ぶと、Viz コンポジタが
 * まだフレームを生成できず `UnknownVizError` を投げることがある（特に大量注釈の
 * 連続変換・並列描画で負荷が高いとき）。初回キャプチャ前に少し待つと発生率が
 * 大きく下がる。 */
const SVG_COMPOSITOR_SETTLE_MS = 120

/** convertSvgToPngInternal が capturePage の一過性エラーで作り直す最大回数。 */
const SVG_CONVERT_MAX_ATTEMPTS = 4

/** SVG文字列をPNGのdataURLへ変換する（共有ウィンドウを直列利用）。
 * capturePage は Viz コンポジタの一過性エラー（`UnknownVizError` 等）を稀に
 * 投げるため、投げられたら共有ウィンドウを作り直して数回までリトライする。 */
async function convertSvgToPngInternal(svgString: string): Promise<{
  dataUrl: string
  /** 描画時に使用すべき論理サイズ（Retinaでimg.widthは2倍になるため） */
  width: number
  height: number
}> {
  const widthMatch = svgString.match(/width="([\d.]+)"/)
  const heightMatch = svgString.match(/height="([\d.]+)"/)
  const width = widthMatch ? Math.ceil(parseFloat(widthMatch[1])) : 200
  const height = heightMatch ? Math.ceil(parseFloat(heightMatch[1])) : 50

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

  let lastError: unknown = null

  for (let attempt = 0; attempt < SVG_CONVERT_MAX_ATTEMPTS; attempt++) {
    const win = getSharedSvgWindow()
    win.setContentSize(width + 20, height + 20)

    const capture = () =>
      withTimeout(
        win.webContents.capturePage({ x: 0, y: 0, width, height }),
        SVG_RENDER_TIMEOUT_MS,
        "capturePage"
      )

    try {
      await withTimeout(win.loadURL(dataUri), SVG_RENDER_TIMEOUT_MS, "loadURL")

      // コンポジタが最初のフレームを生成できるよう少し待ってからキャプチャする。
      await delay(SVG_COMPOSITOR_SETTLE_MS)

      // capturePageが空画像を返す場合は描画未完了なので短い間隔でリトライする
      // （低速機の初回ペイント対策に最大15回 = 約600msまで待つ）。
      let image = await capture()
      for (let empties = 0; empties < 15 && image.isEmpty(); empties++) {
        await delay(40)
        image = await capture()
      }

      if (image.isEmpty()) {
        // 描画リソースが壊れている可能性があるためウィンドウを作り直して再試行
        destroySharedSvgWindow()
        lastError = new Error(
          `capturePage returned an empty image (${width}x${height})`
        )
        await delay(80)
        continue
      }

      const dataUrl = `data:image/png;base64,${image.toPNG().toString("base64")}`
      return { dataUrl, width, height }
    } catch (err) {
      // capturePage/loadURL の一過性エラー（UnknownVizError・GPUストール等）。
      // 共有ウィンドウを破棄して作り直し、次の試行で回復を図る。
      lastError = err
      destroySharedSvgWindow()
      await delay(80)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("SVG to PNG conversion failed")
}

/** Excel・PDF出力・個人成績表・ストリーミングPDF生成に関するIPCチャンネルを登録する */
export function setupExportHandlers(): void {
  // 採点データバリデーション（全エクスポート共通）
  registerHandler(
    "export:validateScoringData",
    async (options: {
      examId: string
      selectedExamStudentIds: string[]
      userId: string
    }) => {
      const exportData = await fetchExportData(
        options.examId,
        options.selectedExamStudentIds
      )

      // 食い違いの内訳（採点者ごとの判定・点数影響）は裁定サマリから供給する。
      // 確定パネルと同じ計算を通すことで、警告と裁定画面の件数がずれない。
      //
      // 裁定サマリだけが落ちても出力は止めない（止めずに伝える）。ただし検査できな
      // かったことを空配列＝食い違いなしへ化けさせず、結果に載せて画面へ出す。
      let conflictWarnings: ConflictWarning[] = []
      let conflictCheckError: string | undefined
      try {
        const decisionSummary = await getExamDecisionSummary(
          options.examId,
          options.userId
        )
        conflictWarnings = buildConflictWarnings(
          decisionSummary,
          options.selectedExamStudentIds
        )
      } catch (error) {
        conflictCheckError =
          error instanceof Error
            ? error.message
            : "採点者間の食い違いを検査できませんでした"
      }

      return validateScoringData(
        exportData.scoringData,
        conflictWarnings,
        conflictCheckError
      )
    }
  )

  // 未解決の食い違いを含んだまま出力したことを監査ログに残す。
  // 出力そのものは止めない（配布物も汚さない）が、後から辿れるようにする。
  registerHandler(
    "export:recordUnresolvedConflicts",
    async (options: {
      examId: string
      userId: string
      exportType: string
      conflicts: Array<{ studentName: string; questionLabel: string }>
      scoreImpact: number
    }) => {
      const scope = await resolveExamScope(options.examId)
      await recordAuditLog({
        action: "exam.score.export_unresolved",
        userId: options.userId,
        entityType: "Exam",
        entityId: options.examId,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        summary: `未解決の食い違い${options.conflicts.length}件を含む採点結果を出力しました（合計点が最大${options.scoreImpact}点低く出ます）`,
        extra: {
          exportType: options.exportType,
          conflicts: options.conflicts.map(
            (conflict) => `${conflict.studentName} - ${conflict.questionLabel}`
          ),
        },
      })
    }
  )

  // Excel Export handlers
  registerHandler(
    "export-grading-data-excel",
    async (options: {
      examId: string
      selectedExamStudentIds: string[]
      outputPath?: string
      studentPlacements?: Record<string, StudentExportPlacement>
    }) => {
      return await exportGradingDataExcel(options)
    }
  )

  // R / exametrika 向けデータ出力（#834）
  registerHandler("export-r-data", async (options: ExportRDataOptions) => {
    return await exportRData(options)
  })

  // Excelプレビュー用データ取得
  registerHandler(
    "export:getExcelPreviewData",
    async (options: {
      examId: string
      selectedExamStudentIds: string[]
      studentPlacements?: Record<string, StudentExportPlacement>
    }) => {
      const exportData = await fetchExportData(
        options.examId,
        options.selectedExamStudentIds,
        options.studentPlacements
      )
      // Prismaの Decimal/Date 型はIPC経由でcloneできないため、
      // プレーンなJSオブジェクトに変換して返す
      const questionRegions = exportData.questionRegions.map(
        (questionRegion) => ({
          id: questionRegion.id,
          label: questionRegion.label,
          points:
            questionRegion.points != null
              ? Number(questionRegion.points)
              : null,
          orderIndex:
            questionRegion.orderIndex != null
              ? Number(questionRegion.orderIndex)
              : null,
        })
      )

      const scoringData = exportData.scoringData.map((studentScoring) => ({
        examStudentId: studentScoring.examStudentId,
        studentName: studentScoring.studentName,
        studentNumber: studentScoring.studentNumber,
        grade: studentScoring.grade,
        className: studentScoring.className,
        attendanceNumber:
          studentScoring.attendanceNumber != null
            ? Number(studentScoring.attendanceNumber)
            : null,
        status: studentScoring.status,
        scores: studentScoring.scores.map((score) => ({
          questionId: score.questionId,
          questionLabel: score.questionLabel,
          score: score.score != null ? Number(score.score) : null,
          maxScore: Number(score.maxScore),
          status: score.status,
        })),
        totalScore:
          studentScoring.totalScore != null
            ? Number(studentScoring.totalScore)
            : null,
        totalMaxScore: Number(studentScoring.totalMaxScore),
        subtotalScores: studentScoring.subtotalScores.map((subtotalScore) => ({
          subtotalId: subtotalScore.subtotalId,
          subtotalLabel: subtotalScore.subtotalLabel,
          score:
            subtotalScore.score != null ? Number(subtotalScore.score) : null,
          maxScore: Number(subtotalScore.maxScore),
        })),
      }))

      return {
        questionRegions,
        subtotalColumns: exportData.subtotalColumns,
        scoringData,
      }
    }
  )

  // Canvas描画用PDF出力データ取得
  registerHandler(
    "export:getPdfExportData",
    async (options: { examId: string; selectedExamStudentIds: string[] }) => {
      return await getPdfExportData(options)
    }
  )

  // PDF保存先選択ダイアログ（Canvas描画前に呼び出す）
  registerHandler(
    "export:selectPdfSavePath",
    async (options: {
      examName?: string
    }): Promise<{ canceled: true } | { canceled: false; filePath: string }> => {
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
        return { canceled: true }
      }

      return { canceled: false, filePath: result.filePath }
    }
  )

  // SVG→PNG変換ハンドラ（MathJaxテキストのtaint問題回避用）
  // 共有オフスクリーンウィンドウ（convertSvgToPngInternal）を直列利用する。
  // 要求が並列に来ても svgConvertChain で順序化し、リソース競合を防ぐ。
  registerHandler(
    "export:convertSvgToPng",
    (options: { svgString: string; width?: number; height?: number }) => {
      pendingSvgConversions++
      const run = svgConvertChain
        .then(() => convertSvgToPngInternal(options.svgString))
        .finally(() => {
          pendingSvgConversions--
          // 要求が掃けたら共有ウィンドウのアイドル破棄を予約する
          if (pendingSvgConversions === 0) scheduleSvgWindowTeardown()
        })
      // 変換1件の失敗で直列チェーンを途切れさせない（失敗は run 側で伝わる）
      svgConvertChain = run.catch(() => undefined)
      return run
    }
  )

  // ============================================================
  // ストリーミングPDF生成API
  // ============================================================

  // ストリーミングセッション作成
  registerHandler(
    "export:createPdfStreamingSession",
    async (options: {
      totalPages: number
      pdfOrientation?: "portrait" | "landscape"
    }) => {
      return await createPdfStreamingSession(options)
    }
  )

  // ストリーミングセッションにページを追加
  registerHandler(
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
  registerHandler(
    "export:finalizeStreamingSession",
    async (options: { sessionId: string; outputPath: string }) => {
      return await finalizeStreamingSession(options)
    }
  )

  // ストリーミングセッションをキャンセル
  registerHandler(
    "export:cancelStreamingSession",
    async (sessionId: string) => {
      cancelStreamingSession(sessionId)
    }
  )

  // ============================================================
  // 個人成績表PDF API
  // ============================================================

  // 個人成績表用データ取得
  registerHandler(
    "export:getIndividualReportData",
    async (options: GetIndividualReportDataOptions) => {
      return await fetchIndividualReportData(options)
    }
  )

  // 個人成績表用小計点グループ一覧取得
  registerHandler(
    "export:getSubtotalGroupsForReport",
    async (examId: string) => {
      return await fetchSubtotalGroupsForReport(examId)
    }
  )

  // HTMLからPDFを生成（ブラウザ印刷機能を使用）
  registerHandler(
    "export:printHtmlToPdf",
    async (options: {
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
    }): Promise<void> => {
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

  // ============================================================
  // 印刷ダイアログを表示するAPI
  // ============================================================

  // HTMLからPDFを生成してプレビューで開く
  registerHandler(
    "export:openPrintDialog",
    async (options: {
      html: string
      title?: string
      pageSize?: "A4" | "Letter" | { width: number; height: number }
      landscape?: boolean
    }): Promise<void> => {
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
  registerHandler(
    "export:captureReturnSnapshot",
    async (options: { examId: string; examStudentIds: string[] }) => {
      return await captureReturnSnapshot({
        examId: options.examId,
        examStudentIds: options.examStudentIds,
      })
    }
  )

  // 返却版と現在状態の差分（変更があった生徒の検出）
  registerHandler("export:getReturnDiff", async (examId: string) => {
    return await getReturnDiff(examId)
  })
}
