/**
 * @fileoverview 描画アノテーション IPCハンドラー
 * @description フロントエンド↔バックエンド間の描画アノテーション通信
 */

import { ipcMain } from "electron"
import * as drawingService from "../lib/prisma/drawingAnnotation"
import type {
  DrawingCreateData,
  DrawingUpdateData,
  DrawingType,
} from "../../types/drawingAnnotation.types"

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
    async (_, questionScoreId: string, type?: DrawingType) => {
      try {
        const result =
          await drawingService.getDrawingAnnotationsByQuestionScore(
            questionScoreId,
            type
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
   * 特定の学生・プロジェクトの全描画アノテーション取得（透明度制御用）
   */
  ipcMain.handle(
    "drawing:getByStudent",
    async (_, studentId: string, projectId: string, type?: DrawingType) => {
      try {
        const result = await drawingService.getDrawingAnnotationsByStudent(
          studentId,
          projectId,
          type
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
   * プロジェクト全体の描画アノテーション取得（PDF出力用）
   */
  ipcMain.handle(
    "drawing:getByProject",
    async (_, projectId: string, type?: DrawingType) => {
      try {
        const result = await drawingService.getDrawingAnnotationsByProject(
          projectId,
          type
        )
        return { success: true, data: result }
      } catch (error) {
        console.error("🚫 プロジェクト別描画アノテーション取得エラー:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "プロジェクト別描画アノテーション取得に失敗しました",
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
    "drawing:getByProject",
    "drawing:update",
    "drawing:delete",
    "drawing:deleteByQuestionScore",
    "drawing:batchCreate",
    "drawing:batchUpdate",
    "drawing:getStats",
    "drawing:getById",
  ]

  handlers.forEach((handler) => {
    ipcMain.removeAllListeners(handler)
  })
}
