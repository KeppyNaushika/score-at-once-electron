/**
 * @fileoverview 描画アノテーション IPCハンドラー
 * @description フロントエンド↔バックエンド間の描画アノテーション通信
 */

import type {
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "../../src/types/drawingAnnotation.types"
import * as drawingService from "../lib/prisma/drawingAnnotation"
import { registerSafeHandler } from "./ipcHandlerUtils"

/**
 * 描画アノテーション関連のIPCハンドラーを設定する
 * 全ての描画ツール（テキスト・直線・長方形・楕円）に対応
 */
export function setupDrawingHandlers() {
  // 基本CRUD操作

  /** 描画アノテーション作成 */
  registerSafeHandler(
    "drawing:create",
    async (data: DrawingCreateData) => {
      const result = await drawingService.createDrawingAnnotation(data)
      return { success: true, data: result }
    },
    "描画アノテーション作成に失敗しました"
  )

  /** QuestionScoreに紐づく描画アノテーション取得 */
  registerSafeHandler(
    "drawing:getByQuestionScore",
    async (questionScoreId: string, type?: DrawingType, userId?: string) => {
      const result = await drawingService.getDrawingAnnotationsByQuestionScore(
        questionScoreId,
        type,
        userId
      )
      return { success: true, data: result }
    },
    "描画アノテーション取得に失敗しました"
  )

  /** 特定の受験者の全描画アノテーション取得（透明度制御用） */
  registerSafeHandler(
    "drawing:getByExamStudent",
    async (examStudentId: string, type?: DrawingType, userId?: string) => {
      const result = await drawingService.getDrawingAnnotationsByExamStudent(
        examStudentId,
        type,
        userId
      )
      return { success: true, data: result }
    },
    "受験者別描画アノテーション取得に失敗しました"
  )

  /** 試験全体の描画アノテーション取得（PDF出力用） */
  registerSafeHandler(
    "drawing:getByExam",
    async (examId: string, type?: DrawingType, userId?: string) => {
      const result = await drawingService.getDrawingAnnotationsByExam(
        examId,
        type,
        userId
      )
      return { success: true, data: result }
    },
    "試験別描画アノテーション取得に失敗しました"
  )

  /** CropRegion（設問）に紐づく全学生の描画アノテーション取得（Grid表示用） */
  registerSafeHandler(
    "drawing:getByCropRegion",
    async (cropRegionId: string, userId?: string) => {
      const result = await drawingService.getDrawingAnnotationsByCropRegion(
        cropRegionId,
        userId
      )
      return { success: true, data: result }
    },
    "設問別描画アノテーション取得に失敗しました"
  )

  /** 描画アノテーション更新 */
  registerSafeHandler(
    "drawing:update",
    async (id: string, data: DrawingUpdateData) => {
      const result = await drawingService.updateDrawingAnnotation(id, data)
      return { success: true, data: result }
    },
    "描画アノテーション更新に失敗しました"
  )

  /** 描画アノテーション削除 */
  registerSafeHandler(
    "drawing:delete",
    async (id: string) => {
      await drawingService.deleteDrawingAnnotation(id)
      return { success: true }
    },
    "描画アノテーション削除に失敗しました"
  )

  /** QuestionScoreに紐づく描画アノテーション一括削除 */
  registerSafeHandler(
    "drawing:deleteByQuestionScore",
    async (questionScoreId: string, type?: DrawingType) => {
      await drawingService.deleteDrawingAnnotationsByQuestionScore(
        questionScoreId,
        type
      )
      return { success: true }
    },
    "描画アノテーション一括削除に失敗しました"
  )

  // バッチ操作

  /** 描画アノテーション一括作成 */
  registerSafeHandler(
    "drawing:batchCreate",
    async (annotations: DrawingCreateData[]) => {
      const result =
        await drawingService.batchCreateDrawingAnnotations(annotations)
      return { success: true, data: result }
    },
    "描画アノテーション一括作成に失敗しました"
  )

  /** 描画アノテーション一括更新 */
  registerSafeHandler(
    "drawing:batchUpdate",
    async (updates: Array<{ id: string; data: DrawingUpdateData }>) => {
      const result = await drawingService.batchUpdateDrawingAnnotations(updates)
      return { success: true, data: result }
    },
    "描画アノテーション一括更新に失敗しました"
  )

  // ユーティリティ操作

  /** 描画アノテーション統計情報取得 */
  registerSafeHandler(
    "drawing:getStats",
    async (questionScoreId: string) => {
      const result =
        await drawingService.getDrawingAnnotationStats(questionScoreId)
      return { success: true, data: result }
    },
    "描画アノテーション統計取得に失敗しました"
  )

  /** アノテーションお気に入り切替 */
  registerSafeHandler(
    "drawing:toggleFavorite",
    async (id: string, isFavorite: boolean) => {
      const result = await drawingService.toggleAnnotationFavorite(
        id,
        isFavorite
      )
      return { success: true, data: result }
    },
    "アノテーションお気に入り切替に失敗しました"
  )

  /** ブラウズ用アノテーション取得 */
  registerSafeHandler(
    "drawing:getForBrowse",
    async (examId: string) => {
      const result = await drawingService.getAnnotationsForBrowse(examId)
      return { success: true, data: result }
    },
    "ブラウズ用アノテーション取得に失敗しました"
  )

  /** 描画アノテーションID取得 */
  registerSafeHandler(
    "drawing:getById",
    async (id: string) => {
      const result = await drawingService.getDrawingAnnotationById(id)
      return { success: true, data: result }
    },
    "描画アノテーション取得に失敗しました"
  )
}
