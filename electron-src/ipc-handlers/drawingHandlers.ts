/**
 * @fileoverview 描画アノテーション IPCハンドラー
 * @description フロントエンド↔バックエンド間の描画アノテーション通信
 */

import type {
  DrawingAnnotation,
  DrawingType,
} from "../../src/types/drawingAnnotation.types"
import * as drawingService from "../lib/prisma/drawingAnnotation"
import { registerHandler } from "./ipcHandlerUtils"

/**
 * 描画アノテーション関連のIPCハンドラーを設定する
 * 全ての描画ツール（テキスト・直線・長方形・楕円）に対応
 */
export function setupDrawingHandlers() {
  // 基本CRUD操作

  /** 描画アノテーション作成 */
  registerHandler("drawing:create", async (annotation: DrawingAnnotation) => {
    const result = await drawingService.createDrawingAnnotation(annotation)
    return result
  })

  /** QuestionScoreに紐づく描画アノテーション取得 */
  registerHandler(
    "drawing:getByQuestionScore",
    async (questionScoreId: string, type?: DrawingType) => {
      const result = await drawingService.getDrawingAnnotationsByQuestionScore(
        questionScoreId,
        type
      )
      return result
    }
  )

  /** 特定の受験者の全描画アノテーション取得（透明度制御用） */
  registerHandler(
    "drawing:getByExamStudent",
    async (examStudentId: string, type?: DrawingType, userId?: string) => {
      const result = await drawingService.getDrawingAnnotationsByExamStudent(
        examStudentId,
        type,
        userId
      )
      return result
    }
  )

  /** CropRegion（設問）に紐づく全学生の描画アノテーション取得（Grid表示用） */
  registerHandler(
    "drawing:getByCropRegion",
    async (cropRegionId: string, userId?: string) => {
      const result = await drawingService.getDrawingAnnotationsByCropRegion(
        cropRegionId,
        userId
      )
      return result
    }
  )

  /** 描画アノテーション更新 */
  registerHandler("drawing:update", async (annotation: DrawingAnnotation) => {
    const result = await drawingService.updateDrawingAnnotation(annotation)
    return result
  })

  /** 描画アノテーション削除 */
  registerHandler("drawing:delete", async (id: string) => {
    await drawingService.deleteDrawingAnnotation(id)
  })

  /** QuestionScoreに紐づく描画アノテーション一括削除 */
  registerHandler(
    "drawing:deleteByQuestionScore",
    async (questionScoreId: string, type?: DrawingType) => {
      await drawingService.deleteDrawingAnnotationsByQuestionScore(
        questionScoreId,
        type
      )
    }
  )

  // バッチ操作

  /** 描画アノテーション一括作成 */
  registerHandler(
    "drawing:batchCreate",
    async (annotations: DrawingAnnotation[]) => {
      const result =
        await drawingService.batchCreateDrawingAnnotations(annotations)
      return result
    }
  )

  // ユーティリティ操作

  /** アノテーションお気に入り切替 */
  registerHandler(
    "drawing:toggleFavorite",
    async (id: string, isFavorite: boolean) => {
      const result = await drawingService.toggleAnnotationFavorite(
        id,
        isFavorite
      )
      return result
    }
  )

  /** ブラウズ用アノテーション取得 */
  registerHandler("drawing:getForBrowse", async (examId: string) => {
    const result = await drawingService.getAnnotationsForBrowse(examId)
    return result
  })
}
