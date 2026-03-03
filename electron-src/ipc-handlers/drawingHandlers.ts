/**
 * @fileoverview 描画アノテーション IPCハンドラー
 * @description フロントエンド↔バックエンド間の描画アノテーション通信
 */

import { ipcMain } from "electron"

import type {
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "../../types/drawingAnnotation.types"
import * as drawingService from "../lib/prisma/drawingAnnotation"

/**
 * 描画アノテーション関連のIPCハンドラーを設定する
 * 全ての描画ツール（テキスト・直線・長方形・楕円）に対応
 */
export function setupDrawingHandlers() {
  // 基本CRUD操作

  /**
   * 描画アノテーション作成
   */
  ipcMain.handle("drawing:create", async (_, data: DrawingCreateData) => {
    try {
      const result = await drawingService.createDrawingAnnotation(data)
      return { success: true, data: result }
    } catch (error) {
      console.error("🚫 描画アノテーション作成エラー:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "描画アノテーション作成に失敗しました",
      }
    }
  })

  /**
   * QuestionScoreに紐づく描画アノテーション取得
   */
  ipcMain.handle(
    "drawing:getByQuestionScore",
    async (_, questionScoreId: string, type?: DrawingType, userId?: string) => {
      try {
        const result =
          await drawingService.getDrawingAnnotationsByQuestionScore(
            questionScoreId,
            type,
            userId
          )
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 描画アノテーション取得エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "描画アノテーション取得に失敗しました",
        }
      }
    }
  )

  /**
   * 特定の学生・試験の全描画アノテーション取得（透明度制御用）
   */
  ipcMain.handle(
    "drawing:getByStudent",
    async (
      _,
      studentId: string,
      examId: string,
      type?: DrawingType,
      userId?: string
    ) => {
      try {
        const result = await drawingService.getDrawingAnnotationsByStudent(
          studentId,
          examId,
          type,
          userId
        )
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 学生別描画アノテーション取得エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "学生別描画アノテーション取得に失敗しました",
        }
      }
    }
  )

  /**
   * 試験全体の描画アノテーション取得（PDF出力用）
   */
  ipcMain.handle(
    "drawing:getByExam",
    async (_, examId: string, type?: DrawingType, userId?: string) => {
      try {
        const result = await drawingService.getDrawingAnnotationsByExam(
          examId,
          type,
          userId
        )
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 試験別描画アノテーション取得エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "試験別描画アノテーション取得に失敗しました",
        }
      }
    }
  )

  /**
   * 描画アノテーション更新
   */
  ipcMain.handle(
    "drawing:update",
    async (_, id: string, data: DrawingUpdateData) => {
      try {
        const result = await drawingService.updateDrawingAnnotation(id, data)
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 描画アノテーション更新エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "描画アノテーション更新に失敗しました",
        }
      }
    }
  )

  /**
   * 描画アノテーション削除
   */
  ipcMain.handle("drawing:delete", async (_, id: string) => {
    try {
      await drawingService.deleteDrawingAnnotation(id)
      return { success: true }
    } catch (error) {
      console.error("🚫 描画アノテーション削除エラー:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "描画アノテーション削除に失敗しました",
      }
    }
  })

  /**
   * QuestionScoreに紐づく描画アノテーション一括削除
   */
  ipcMain.handle(
    "drawing:deleteByQuestionScore",
    async (_, questionScoreId: string, type?: DrawingType) => {
      try {
        await drawingService.deleteDrawingAnnotationsByQuestionScore(
          questionScoreId,
          type
        )
        return { success: true }
      } catch (error) {
        console.error("🚫 描画アノテーション一括削除エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "描画アノテーション一括削除に失敗しました",
        }
      }
    }
  )

  // バッチ操作

  /**
   * 描画アノテーション一括作成
   */
  ipcMain.handle(
    "drawing:batchCreate",
    async (_, annotations: DrawingCreateData[]) => {
      try {
        const result =
          await drawingService.batchCreateDrawingAnnotations(annotations)
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 描画アノテーション一括作成エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "描画アノテーション一括作成に失敗しました",
        }
      }
    }
  )

  /**
   * 描画アノテーション一括更新
   */
  ipcMain.handle(
    "drawing:batchUpdate",
    async (_, updates: Array<{ id: string; data: DrawingUpdateData }>) => {
      try {
        const result =
          await drawingService.batchUpdateDrawingAnnotations(updates)
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 描画アノテーション一括更新エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "描画アノテーション一括更新に失敗しました",
        }
      }
    }
  )

  // ユーティリティ操作

  /**
   * 描画アノテーション統計情報取得
   */
  ipcMain.handle("drawing:getStats", async (_, questionScoreId: string) => {
    try {
      const result =
        await drawingService.getDrawingAnnotationStats(questionScoreId)
      return { success: true, data: result }
    } catch (error) {
      console.error("🚫 描画アノテーション統計取得エラー:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "描画アノテーション統計取得に失敗しました",
      }
    }
  })

  /**
   * アノテーションお気に入り切替
   */
  ipcMain.handle(
    "drawing:toggleFavorite",
    async (_, id: string, isFavorite: boolean) => {
      try {
        const result = await drawingService.toggleAnnotationFavorite(
          id,
          isFavorite
        )
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 アノテーションお気に入り切替エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "アノテーションお気に入り切替に失敗しました",
        }
      }
    }
  )

  /**
   * ブラウズ用アノテーション取得
   */
  ipcMain.handle("drawing:getForBrowse", async (_, examId: string) => {
    try {
      const result = await drawingService.getAnnotationsForBrowse(examId)
      return { success: true, data: result }
    } catch (error) {
      console.error("🚫 ブラウズ用アノテーション取得エラー:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "ブラウズ用アノテーション取得に失敗しました",
      }
    }
  })

  /**
   * 描画アノテーションID取得
   */
  ipcMain.handle("drawing:getById", async (_, id: string) => {
    try {
      const result = await drawingService.getDrawingAnnotationById(id)
      return { success: true, data: result }
    } catch (error) {
      console.error("🚫 描画アノテーション単体取得エラー:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "描画アノテーション取得に失敗しました",
      }
    }
  })
}

/**
 * 描画アノテーション関連のIPCハンドラーを削除する
 */
export function removeDrawingHandlers() {
  const handlers = [
    "drawing:create",
    "drawing:getByQuestionScore",
    "drawing:getByStudent",
    "drawing:getByExam",
    "drawing:update",
    "drawing:delete",
    "drawing:deleteByQuestionScore",
    "drawing:batchCreate",
    "drawing:batchUpdate",
    "drawing:getStats",
    "drawing:getById",
    "drawing:toggleFavorite",
    "drawing:getForBrowse",
  ]

  handlers.forEach((handler) => {
    ipcMain.removeAllListeners(handler)
  })
}
