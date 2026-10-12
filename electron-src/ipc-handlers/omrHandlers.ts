/**
 * OMR（光学マーク認識）IPC ハンドラー
 */

import { BrowserWindow } from "electron"
import * as fsPromises from "fs/promises"

import type { ComputedCell } from "../../src/types/answerSheetLayout.types"
import type {
  MarkerDetectionResult,
  OMRBatchProgress,
  OMRCellConfig,
  OMRRecognitionParams,
  OMRSheetResult,
} from "../../src/types/omr.types"
import { getSharedFilesDirectory } from "../lib/dataManager"
import { createTransform } from "../lib/omr/coordinateTransform"
import {
  detectCornerMarkers,
  resolveAnswerCorners,
} from "../lib/omr/cornerMarkerDetector"
import { correctImage } from "../lib/omr/imageCorrector"
import { loadImageRaw } from "../lib/omr/imageProcessor"
import { recognizeCells } from "../lib/omr/markRecognizer"
import { requireUnderRoot, resolveUnderRoot } from "../lib/pathContainment"
import prisma from "../lib/prisma/client"
import { type HandlerMap } from "./ipcHandlerUtils"

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
async function getMtimeMs(imagePath: string): Promise<number | null> {
  try {
    return (await fsPromises.stat(imagePath)).mtimeMs
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

/** OMR（光学マーク認識）のバッチ処理・マスターマーカー検出・画像補正のIPCチャンネルを登録する */
export const omrHandlers = {
  // ────────────────────────────────────────
  // バッチ認識（試験全答案）
  // 進捗は BrowserWindow.send で押し出す（戻り値は最後の結果だけ）
  // ────────────────────────────────────────
  "omr:batch-recognize": async (args: {
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
  }): Promise<OMRSheetResult[]> => {
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
        // DB の相対パスを絶対パスに解決（共有するファイルの根の外を指すなら、この答案は失敗）
        const absolutePath = requireUnderRoot(
          getSharedFilesDirectory(),
          entry.path
        )

        const markerResult = await detectCornerMarkers(
          absolutePath,
          args.params.colorThreshold ?? undefined
        )

        // 1隅だけ欠けた答案は、模範解答の4隅との対応から残り3隅で推定する。
        // 2隅以上欠けていれば位置を合わせられない
        const [expectedTL, expectedTR, expectedBL, expectedBR] =
          args.expectedCorners
        const resolved = resolveAnswerCorners(markerResult, {
          TL: expectedTL,
          TR: expectedTR,
          BL: expectedBL,
          BR: expectedBR,
        })

        if (!resolved) {
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
          const transform = createTransform(
            resolved.corners,
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
            estimatedCorner: resolved.estimatedCorner,
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
  },

  // ────────────────────────────────────────
  // マスター画像のコーナーマーカー一括検出
  // ────────────────────────────────────────
  "omr:detect-master-markers": async (
    examId: string,
    colorThreshold?: number
  ): Promise<{
    pages: Array<{
      examPageId: string
      pageNumber: number
      result: MarkerDetectionResult
    }>
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

    const dataDir = getSharedFilesDirectory()

    for (const examPage of examPages) {
      // 模範解答画像の無いページは検出できない。飛ばさないと例外が
      // ハンドラ全体を落とし、他ページの検出結果ごと失われる
      if (!examPage.imagePath) continue

      const examPageId = examPage.id
      const pageNumber = examPage.pageNumber
      const cacheKey = markerCacheKey(examPageId, colorThreshold)
      // 共有するファイルの根の外を指すパスは読まない（画像の無いページと同じく飛ばす）
      const masterImage = resolveUnderRoot(dataDir, examPage.imagePath)
      if (masterImage.kind !== "ok") continue
      const imagePath = masterImage.absolutePath
      const mtimeMs = await getMtimeMs(imagePath)

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
      throw new Error("マスター画像が見つかりません")
    }

    // 「全ページで4マーカー検出できたか」は pages から導けるので返さない
    return { pages }
  },

  // ────────────────────────────────────────
  // 単一画像補正（クライアント側プレビュー用）
  // ────────────────────────────────────────
  "omr:correct-image": async (
    examPageId: string,
    buffer: Uint8Array,
    colorThreshold?: number
  ): Promise<
    | { status: "corrected"; correctedBuffer: Uint8Array }
    | { status: "skipped"; reason: string }
  > => {
    const cacheKey = markerCacheKey(examPageId, colorThreshold)
    // 模範解答画像は ExamPage.id 直指定で引く（序数 pageNumber では引かない）。
    const examPage = await prisma.examPage.findUnique({
      where: { id: examPageId },
    })
    if (!examPage?.imagePath) {
      return { status: "skipped", reason: "マスター画像が見つかりません" }
    }
    const masterImage = resolveUnderRoot(
      getSharedFilesDirectory(),
      examPage.imagePath
    )
    if (masterImage.kind !== "ok") {
      return { status: "skipped", reason: "マスター画像が見つかりません" }
    }
    const imagePath = masterImage.absolutePath
    const mtimeMs = await getMtimeMs(imagePath)

    let masterResult = getCachedMarkerResult(cacheKey, mtimeMs)
    if (!masterResult) {
      masterResult = await detectCornerMarkers(imagePath, colorThreshold)
      if (mtimeMs !== null) {
        masterMarkerCache.set(cacheKey, { mtimeMs, result: masterResult })
      }
    }

    if (!masterResult.success) {
      return {
        status: "skipped",
        reason: "マスター画像のマーカーが検出できませんでした",
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
        status: "corrected",
        correctedBuffer: new Uint8Array(result.correctedBuffer),
      }
    }
    return {
      status: "skipped",
      reason: result.error ?? "画像補正に失敗しました",
    }
  },
} satisfies HandlerMap
