/**
 * OMR（光学マーク認識）IPC ハンドラー
 */

import { BrowserWindow, ipcMain } from "electron"
import * as fs from "fs"
import * as path from "path"

import type { ComputedCell } from "../../src/types/answerSheetLayout.types"
import type {
  MarkerDetectionResult,
  OMRBatchProgress,
  OMRCellConfig,
  OMRRecognitionParams,
  OMRSheetResult,
} from "../../src/types/omr.types"
import { getDataDirectory } from "../lib/dataManager"
import { createTransform } from "../lib/omr/coordinateTransform"
import { detectCornerMarkers } from "../lib/omr/cornerMarkerDetector"
import { correctImage } from "../lib/omr/imageCorrector"
import { loadImageRaw } from "../lib/omr/imageProcessor"
import { recognizeCells } from "../lib/omr/markRecognizer"
import prisma from "../lib/prisma/client"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/**
 * マスターマーカー検出キャッシュ (キー: "examPageId:colorThreshold")
 *
 * ページの同定は ExamPage.id。序数 pageNumber はページ挿入・並べ替えでシフトし、
 * 別ページの検出結果を引いてしまうためキーに使わない。
 *
 * 画像ファイルのmtimeを保持し、ファイルが差し替えられた場合は
 * キャッシュを無効とみなして再検出する（アプリ外でのファイル差し替えにも追従）。
 */
const masterMarkerCache = new Map<
  string,
  { mtimeMs: number; result: MarkerDetectionResult }
>()

/** マスターマーカー検出キャッシュのキー */
function markerCacheKey(examPageId: string, colorThreshold?: number): string {
  return `${examPageId}:${colorThreshold ?? 128}`
}

/** 画像のmtimeを取得（取得できない場合はnull＝キャッシュ不使用） */
function getMtimeMs(imagePath: string): number | null {
  try {
    return fs.statSync(imagePath).mtimeMs
  } catch {
    return null
  }
}

/** キャッシュが現在のファイル状態に対して有効なら検出結果を返す */
function getCachedMarkerResult(
  cacheKey: string,
  mtimeMs: number | null
): MarkerDetectionResult | null {
  if (mtimeMs === null) return null
  const cached = masterMarkerCache.get(cacheKey)
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.result
  }
  return null
}

/** OMR（光学マーク認識）のマーカー検出・シート認識・バッチ処理に関するIPCチャンネルを登録する */
export function setupOMRHandlers(): void {
  // ────────────────────────────────────────
  // 単一画像のコーナーマーカー検出
  // ────────────────────────────────────────
  registerHandler(
    "omr:detect-markers",
    async (
      imagePath: string,
      colorThreshold?: number
    ): Promise<MarkerDetectionResult> => {
      return detectCornerMarkers(imagePath, colorThreshold)
    }
  )

  // ────────────────────────────────────────
  // 1枚の答案シート認識
  // NOTE: Has custom error return format (OMRSheetResult), kept as manual ipcMain.handle
  // ────────────────────────────────────────
  ipcMain.handle(
    "omr:recognize-sheet",
    async (
      _event,
      args: {
        imagePath: string
        cells: ComputedCell[]
        cellConfigs: Record<string, OMRCellConfig>
        expectedCorners: [
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
        ]
        params: OMRRecognitionParams
        pageIndex?: number
        examStudentId?: string
      }
    ): Promise<OMRSheetResult> => {
      try {
        // 1. マーカー検出
        // マーカー検出の閾値は据え置き（印刷された黒マーカーは鉛筆と最適値が違う）。
        // null=自動 はバブル判定側だけに効かせ、検出結果キャッシュのキーを安定させる
        const markerResult = await detectCornerMarkers(
          args.imagePath,
          args.params.colorThreshold ?? undefined
        )
        if (!markerResult.success) {
          return {
            success: false,
            pageIndex: args.pageIndex ?? 0,
            markerDetection: markerResult,
            cellResults: [],
            error: markerResult.error,
          }
        }

        // 2. 座標変換を構築
        const sortedMarkers = {
          TL: markerResult.markers.find((marker) => marker.corner === "TL")!,
          TR: markerResult.markers.find((marker) => marker.corner === "TR")!,
          BL: markerResult.markers.find((marker) => marker.corner === "BL")!,
          BR: markerResult.markers.find((marker) => marker.corner === "BR")!,
        }

        const transform = createTransform(
          [
            { x: sortedMarkers.TL.centerX, y: sortedMarkers.TL.centerY },
            { x: sortedMarkers.TR.centerX, y: sortedMarkers.TR.centerY },
            { x: sortedMarkers.BL.centerX, y: sortedMarkers.BL.centerY },
            { x: sortedMarkers.BR.centerX, y: sortedMarkers.BR.centerY },
          ],
          args.expectedCorners,
          markerResult.imageWidth,
          markerResult.imageHeight
        )

        // 3. 画像読み込み
        const rawImage = await loadImageRaw(args.imagePath)

        // 4. マーク認識
        const cellResults = await recognizeCells(
          args.cells,
          args.cellConfigs,
          rawImage,
          transform,
          args.params
        )

        return {
          success: true,
          examStudentId: args.examStudentId,
          pageIndex: args.pageIndex ?? 0,
          markerDetection: markerResult,
          cellResults,
        }
      } catch (error) {
        console.error("Error in IPC handler [omr:recognize-sheet]:", error)
        return {
          success: false,
          pageIndex: args.pageIndex ?? 0,
          markerDetection: {
            success: false,
            markers: [],
            imageWidth: 0,
            imageHeight: 0,
            error: String(error),
          },
          cellResults: [],
          error:
            error instanceof Error ? error.message : "OMR認識に失敗しました",
        }
      }
    }
  )

  // ────────────────────────────────────────
  // バッチ認識（試験全答案）
  // NOTE: Has complex loop with progress reporting via BrowserWindow.send, kept as manual ipcMain.handle
  // ────────────────────────────────────────
  ipcMain.handle(
    "omr:batch-recognize",
    async (
      _event,
      args: {
        imagePaths: {
          path: string
          examStudentId?: string
          studentName?: string
        }[]
        cells: ComputedCell[]
        cellConfigs: Record<string, OMRCellConfig>
        expectedCorners: [
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
        ]
        params: OMRRecognitionParams
        pageIndex?: number
      }
    ): Promise<OMRSheetResult[]> => {
      const results: OMRSheetResult[] = []
      const total = args.imagePaths.length
      let processed = 0
      let succeeded = 0
      let failed = 0

      for (const entry of args.imagePaths) {
        // プログレス通知
        const progress: OMRBatchProgress = {
          total,
          processed,
          succeeded,
          failed,
          currentStudentName: entry.studentName,
        }
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          win.webContents.send("omr:batch-progress", progress)
        }

        try {
          // 相対パスを絶対パスに解決
          const absolutePath = path.isAbsolute(entry.path)
            ? entry.path
            : path.join(getDataDirectory(), entry.path)

          const markerResult = await detectCornerMarkers(
            absolutePath,
            args.params.colorThreshold ?? undefined
          )

          if (!markerResult.success) {
            results.push({
              success: false,
              examStudentId: entry.examStudentId,
              pageIndex: args.pageIndex ?? 0,
              markerDetection: markerResult,
              cellResults: [],
              error: markerResult.error,
            })
            failed++
          } else {
            const sortedMarkers = {
              TL: markerResult.markers.find(
                (marker) => marker.corner === "TL"
              )!,
              TR: markerResult.markers.find(
                (marker) => marker.corner === "TR"
              )!,
              BL: markerResult.markers.find(
                (marker) => marker.corner === "BL"
              )!,
              BR: markerResult.markers.find(
                (marker) => marker.corner === "BR"
              )!,
            }

            const transform = createTransform(
              [
                { x: sortedMarkers.TL.centerX, y: sortedMarkers.TL.centerY },
                { x: sortedMarkers.TR.centerX, y: sortedMarkers.TR.centerY },
                { x: sortedMarkers.BL.centerX, y: sortedMarkers.BL.centerY },
                { x: sortedMarkers.BR.centerX, y: sortedMarkers.BR.centerY },
              ],
              args.expectedCorners,
              markerResult.imageWidth,
              markerResult.imageHeight
            )

            const rawImage = await loadImageRaw(absolutePath)
            const cellResults = await recognizeCells(
              args.cells,
              args.cellConfigs,
              rawImage,
              transform,
              args.params
            )

            results.push({
              success: true,
              examStudentId: entry.examStudentId,
              pageIndex: args.pageIndex ?? 0,
              markerDetection: markerResult,
              cellResults,
            })
            succeeded++
          }
        } catch (error) {
          results.push({
            success: false,
            examStudentId: entry.examStudentId,
            pageIndex: args.pageIndex ?? 0,
            markerDetection: {
              success: false,
              markers: [],
              imageWidth: 0,
              imageHeight: 0,
            },
            cellResults: [],
            error: String(error),
          })
          failed++
        }

        processed++
      }

      // 完了通知
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        win.webContents.send("omr:batch-progress", {
          total,
          processed,
          succeeded,
          failed,
        })
      }

      return results
    }
  )

  // ────────────────────────────────────────
  // マスター画像のコーナーマーカー一括検出
  // ────────────────────────────────────────
  registerSafeHandler(
    "omr:detect-master-markers",
    async (
      examId: string,
      colorThreshold?: number
    ): Promise<{
      success: boolean
      pages: Array<{
        examPageId: string
        pageNumber: number
        result: MarkerDetectionResult
      }>
      error?: string
    }> => {
      // 模範解答ページを取得
      const examPages = await prisma.examPage.findMany({
        where: { examId },
        orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
      })

      const pages: Array<{
        examPageId: string
        pageNumber: number
        result: MarkerDetectionResult
      }> = []

      const dataDir = getDataDirectory()

      for (const examPage of examPages) {
        // 模範解答画像の無いページは検出できない。飛ばさないと例外が
        // ハンドラ全体を落とし、他ページの検出結果ごと失われる
        if (!examPage.imagePath) continue

        const examPageId = examPage.id
        const pageNumber = examPage.pageNumber
        const cacheKey = markerCacheKey(examPageId, colorThreshold)
        const imagePath = path.join(dataDir, examPage.imagePath)
        const mtimeMs = getMtimeMs(imagePath)

        // キャッシュチェック（ファイル差し替えを検知したら再検出）
        const cached = getCachedMarkerResult(cacheKey, mtimeMs)
        if (cached) {
          pages.push({ examPageId, pageNumber, result: cached })
          continue
        }

        const result = await detectCornerMarkers(imagePath, colorThreshold)

        if (mtimeMs !== null) {
          masterMarkerCache.set(cacheKey, { mtimeMs, result })
        }
        pages.push({ examPageId, pageNumber, result })
      }

      // 画像を持つページが1枚も無ければ検出しようがない。
      // ページ数ではなく検出対象の数で判定する（画像の無いページは上で飛ばしている）
      if (pages.length === 0) {
        return {
          success: false,
          pages: [],
          error: "マスター画像が見つかりません",
        }
      }

      // 全ページで4マーカー検出できたか
      const allSuccess = pages.every((page) => page.result.success)

      return {
        success: allSuccess,
        pages,
        error: allSuccess
          ? undefined
          : "一部のページでマーカーを検出できませんでした",
      }
    },
    "マスターマーカー検出に失敗しました"
  )

  // ────────────────────────────────────────
  // 単一画像補正（クライアント側プレビュー用）
  // ────────────────────────────────────────
  registerSafeHandler(
    "omr:correct-image",
    async (
      examPageId: string,
      buffer: Uint8Array,
      colorThreshold?: number
    ): Promise<{
      success: boolean
      correctedBuffer?: Uint8Array
      status: "corrected" | "skipped"
      error?: string
    }> => {
      const cacheKey = markerCacheKey(examPageId, colorThreshold)
      // 模範解答画像は ExamPage.id 直指定で引く（序数 pageNumber では引かない）。
      const examPage = await prisma.examPage.findUnique({
        where: { id: examPageId },
      })
      if (!examPage?.imagePath) {
        return {
          success: false,
          status: "skipped",
          error: "マスター画像が見つかりません",
        }
      }
      const dataDir = getDataDirectory()
      const imagePath = path.join(dataDir, examPage.imagePath)
      const mtimeMs = getMtimeMs(imagePath)

      let masterResult = getCachedMarkerResult(cacheKey, mtimeMs)
      if (!masterResult) {
        masterResult = await detectCornerMarkers(imagePath, colorThreshold)
        if (mtimeMs !== null) {
          masterMarkerCache.set(cacheKey, { mtimeMs, result: masterResult })
        }
      }

      if (!masterResult.success) {
        return {
          success: false,
          status: "skipped",
          error: "マスター画像のマーカーが検出できませんでした",
        }
      }

      const result = await correctImage(
        Buffer.from(buffer),
        masterResult.markers,
        masterResult.imageWidth,
        masterResult.imageHeight,
        colorThreshold ?? 128
      )

      if (result.success && result.correctedBuffer) {
        return {
          success: true,
          correctedBuffer: new Uint8Array(result.correctedBuffer),
          status: "corrected",
        }
      }
      return {
        success: false,
        status: "skipped",
        error: result.error,
      }
    },
    "画像補正に失敗しました"
  )
}
