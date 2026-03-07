/**
 * OMR（光学マーク認識）IPC ハンドラー
 */

import { BrowserWindow, ipcMain } from "electron"
import fs from "fs"
import path from "path"

import type { ComputedCell } from "../../types/answerSheetLayout.types"
import type {
  MarkerDetectionResult,
  OMRBatchProgress,
  OMRCellConfig,
  OMRRecognitionParams,
  OMRSheetResult,
  OMRTemplate,
} from "../../types/omr.types"
import { getDataDirectory } from "../lib/dataManager"
import {
  createTransform,
  detectCornerMarkers,
  loadImageRaw,
  recognizeCells,
} from "../lib/omr"
import prisma from "../lib/prisma/client"

/** マスターマーカー検出キャッシュ (キー: "examId:pageNumber") */
const masterMarkerCache = new Map<string, MarkerDetectionResult>()

/** キャッシュ無効化（マスター画像変更時に呼び出す） */
export function invalidateMasterMarkerCache(examId: string): void {
  for (const key of masterMarkerCache.keys()) {
    if (key.startsWith(`${examId}:`)) {
      masterMarkerCache.delete(key)
    }
  }
}

export function setupOMRHandlers(): void {
  // ────────────────────────────────────────
  // 単一画像のコーナーマーカー検出
  // ────────────────────────────────────────
  ipcMain.handle(
    "omr:detect-markers",
    async (
      _event,
      imagePath: string,
      colorThreshold?: number
    ): Promise<MarkerDetectionResult> => {
      return detectCornerMarkers(imagePath, colorThreshold)
    }
  )

  // ────────────────────────────────────────
  // 1枚の答案シート認識
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
        studentId?: string
      }
    ): Promise<OMRSheetResult> => {
      try {
        // 1. マーカー検出
        const markerResult = await detectCornerMarkers(
          args.imagePath,
          args.params.colorThreshold
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
          TL: markerResult.markers.find((m) => m.corner === "TL")!,
          TR: markerResult.markers.find((m) => m.corner === "TR")!,
          BL: markerResult.markers.find((m) => m.corner === "BL")!,
          BR: markerResult.markers.find((m) => m.corner === "BR")!,
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
          studentId: args.studentId,
          pageIndex: args.pageIndex ?? 0,
          markerDetection: markerResult,
          cellResults,
        }
      } catch (error) {
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
  // ────────────────────────────────────────
  ipcMain.handle(
    "omr:batch-recognize",
    async (
      _event,
      args: {
        imagePaths: { path: string; studentId?: string; studentName?: string }[]
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
          const markerResult = await detectCornerMarkers(
            entry.path,
            args.params.colorThreshold
          )

          if (!markerResult.success) {
            results.push({
              success: false,
              studentId: entry.studentId,
              pageIndex: args.pageIndex ?? 0,
              markerDetection: markerResult,
              cellResults: [],
              error: markerResult.error,
            })
            failed++
          } else {
            const sortedMarkers = {
              TL: markerResult.markers.find((m) => m.corner === "TL")!,
              TR: markerResult.markers.find((m) => m.corner === "TR")!,
              BL: markerResult.markers.find((m) => m.corner === "BL")!,
              BR: markerResult.markers.find((m) => m.corner === "BR")!,
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

            const rawImage = await loadImageRaw(entry.path)
            const cellResults = await recognizeCells(
              args.cells,
              args.cellConfigs,
              rawImage,
              transform,
              args.params
            )

            results.push({
              success: true,
              studentId: entry.studentId,
              pageIndex: args.pageIndex ?? 0,
              markerDetection: markerResult,
              cellResults,
            })
            succeeded++
          }
        } catch (error) {
          results.push({
            success: false,
            studentId: entry.studentId,
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
  ipcMain.handle(
    "omr:detect-master-markers",
    async (
      _event,
      examId: string,
      colorThreshold?: number
    ): Promise<{
      success: boolean
      pages: Array<{ pageNumber: number; result: MarkerDetectionResult }>
      error?: string
    }> => {
      try {
        // マスター画像を取得
        const masterImages = await prisma.masterImage.findMany({
          where: {
            examPage: { examId },
          },
          include: { examPage: true },
          orderBy: { examPage: { pageNumber: "asc" } },
        })

        if (masterImages.length === 0) {
          return {
            success: false,
            pages: [],
            error: "マスター画像が見つかりません",
          }
        }

        const pages: Array<{
          pageNumber: number
          result: MarkerDetectionResult
        }> = []

        const dataDir = getDataDirectory()

        for (const mi of masterImages) {
          const pageNumber = mi.examPage.pageNumber
          const cacheKey = `${examId}:${pageNumber}`

          // キャッシュチェック
          const cached = masterMarkerCache.get(cacheKey)
          if (cached) {
            pages.push({ pageNumber, result: cached })
            continue
          }

          // 画像パスを解決してマーカー検出
          const imagePath = path.join(dataDir, mi.imagePath)
          const result = await detectCornerMarkers(imagePath, colorThreshold)

          // キャッシュに保存
          masterMarkerCache.set(cacheKey, result)
          pages.push({ pageNumber, result })
        }

        // 全ページで4マーカー検出できたか
        const allSuccess = pages.every((p) => p.result.success)

        return {
          success: allSuccess,
          pages,
          error: allSuccess
            ? undefined
            : "一部のページでマーカーを検出できませんでした",
        }
      } catch (error) {
        return {
          success: false,
          pages: [],
          error:
            error instanceof Error
              ? error.message
              : "マスターマーカー検出に失敗しました",
        }
      }
    }
  )

  // ────────────────────────────────────────
  // OMRテンプレート保存
  // ────────────────────────────────────────
  ipcMain.handle(
    "omr:save-template",
    async (
      _event,
      examId: string,
      template: OMRTemplate
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const dataDir = getDataDirectory()
        const examDir = path.join(dataDir, "exams", examId)
        if (!fs.existsSync(examDir)) {
          fs.mkdirSync(examDir, { recursive: true })
        }
        const templatePath = path.join(examDir, "omr-template.json")
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2))
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "テンプレート保存に失敗しました",
        }
      }
    }
  )

  // ────────────────────────────────────────
  // OMRテンプレート読み込み
  // ────────────────────────────────────────
  ipcMain.handle(
    "omr:load-template",
    async (
      _event,
      examId: string
    ): Promise<{
      success: boolean
      template?: OMRTemplate
      error?: string
    }> => {
      try {
        const dataDir = getDataDirectory()
        const templatePath = path.join(
          dataDir,
          "exams",
          examId,
          "omr-template.json"
        )
        if (!fs.existsSync(templatePath)) {
          return { success: false, error: "テンプレートが見つかりません" }
        }
        const content = fs.readFileSync(templatePath, "utf-8")
        const template = JSON.parse(content) as OMRTemplate
        return { success: true, template }
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "テンプレート読み込みに失敗しました",
        }
      }
    }
  )
}
