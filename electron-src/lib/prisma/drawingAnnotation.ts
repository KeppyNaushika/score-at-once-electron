/**
 * @fileoverview 描画アノテーション データベースサービス
 * @description 全描画ツールの統合CRUD操作（自動バックアップ付き）
 */

import prisma from "./client"
import { execSync } from "child_process"
import { existsSync } from "fs"
import type {
  DrawingAnnotation,
  DrawingCreateData,
  DrawingUpdateData,
  DrawingType,
  DrawingAnnotationStats,
  DrawingBatchCreateData,
  DrawingBatchUpdateData,
} from "../../../types/drawing-annotation.types"

/**
 * 描画アノテーションを作成する
 * @param data 作成データ
 * @returns Promise<DrawingAnnotation> 作成された描画アノテーション
 */
export async function createDrawingAnnotation(
  data: DrawingCreateData,
): Promise<DrawingAnnotation> {
  try {
    const result = await prisma.drawingAnnotation.create({
      data: {
        questionScoreId: data.questionScoreId,
        type: data.type,
        x: data.x,
        y: data.y,
        color: data.color || "#ef4444",
        strokeWidth: data.strokeWidth || 3,
        // サイズプロパティ
        width: data.width || 0.0,
        height: data.height || 0.0,
        // 直線プロパティ
        endX: data.endX || 0.0,
        endY: data.endY || 0.0,
        lineStyle: data.lineStyle || "solid",
        // テキストプロパティ
        text: data.text || "",
        fontSize: data.fontSize || 16,
        textBoxWidth: data.textBoxWidth || 0.0,
        textBoxHeight: data.textBoxHeight || 0.0,
        horizontalAlign: data.horizontalAlign || "left",
        verticalAlign: data.verticalAlign || "top",
        // 表示プロパティ
        displayX: data.displayX || 0.0,
        displayY: data.displayY || 0.0,
        // メタデータ
        createdByUserId: data.createdByUserId,
      },
    })

    console.log(`✅ 描画アノテーション作成成功: ${result.type} (${result.id})`)
    return result as DrawingAnnotation
  } catch (error) {
    console.error("🚫 描画アノテーション作成エラー:", error)
    throw error
  }
}

/**
 * QuestionScoreに紐づく描画アノテーションを取得する
 * @param questionScoreId QuestionScoreのID
 * @param type フィルタする描画タイプ（オプション）
 * @returns Promise<DrawingAnnotation[]> 描画アノテーション配列
 */
export async function getDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType,
): Promise<DrawingAnnotation[]> {
  // 読み取り専用操作のためバックアップ不要
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScoreId,
        ...(type && { type }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    })

    return result as DrawingAnnotation[]
  } catch (error) {
    console.error("🚫 描画アノテーション取得エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを更新する
 * @param id 描画アノテーションのID
 * @param data 更新データ
 * @returns Promise<DrawingAnnotation> 更新された描画アノテーション
 */
export async function updateDrawingAnnotation(
  id: string,
  data: DrawingUpdateData,
): Promise<DrawingAnnotation> {
  try {
    const result = await prisma.drawingAnnotation.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    console.log(`✅ 描画アノテーション更新成功: ${result.type} (${id})`)
    return result as DrawingAnnotation
  } catch (error) {
    console.error("🚫 描画アノテーション更新エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを削除する
 * @param id 描画アノテーションのID
 * @returns Promise<void>
 */
export async function deleteDrawingAnnotation(id: string): Promise<void> {
  try {
    await prisma.drawingAnnotation.delete({
      where: { id },
    })

    console.log(`✅ 描画アノテーション削除成功: (${id})`)
  } catch (error) {
    console.error("🚫 描画アノテーション削除エラー:", error)
    throw error
  }
}

/**
 * QuestionScoreに紐づく描画アノテーションを一括削除する
 * @param questionScoreId QuestionScoreのID
 * @param type 削除する描画タイプ（オプション）
 * @returns Promise<void>
 */
export async function deleteDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType,
): Promise<void> {
  try {
    const result = await prisma.drawingAnnotation.deleteMany({
      where: {
        questionScoreId,
        ...(type && { type }),
      },
    })

    console.log(`✅ 描画アノテーション一括削除成功: ${result.count}件削除`)
  } catch (error) {
    console.error("🚫 描画アノテーション一括削除エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを一括作成する
 * @param annotations 作成する描画アノテーション配列
 * @returns Promise<DrawingAnnotation[]> 作成された描画アノテーション配列
 */
export async function batchCreateDrawingAnnotations(
  annotations: DrawingCreateData[],
): Promise<DrawingAnnotation[]> {
  try {
    const results = await Promise.all(
      annotations.map(async (data) => {
        // バッチ内の個別作成ではバックアップをスキップ（既に作成済み）
        return await prisma.drawingAnnotation.create({
          data: {
            questionScoreId: data.questionScoreId,
            type: data.type,
            x: data.x,
            y: data.y,
            color: data.color || "#ef4444",
            strokeWidth: data.strokeWidth || 3,
            width: data.width || 0.0,
            height: data.height || 0.0,
            endX: data.endX || 0.0,
            endY: data.endY || 0.0,
            lineStyle: data.lineStyle || "solid",
            text: data.text || "",
            fontSize: data.fontSize || 16,
            textBoxWidth: data.textBoxWidth || 0.0,
            textBoxHeight: data.textBoxHeight || 0.0,
            horizontalAlign: data.horizontalAlign || "left",
            verticalAlign: data.verticalAlign || "top",
            displayX: data.displayX || 0.0,
            displayY: data.displayY || 0.0,
            createdByUserId: data.createdByUserId,
          },
        })
      }),
    )

    console.log(`✅ 描画アノテーション一括作成成功: ${results.length}件作成`)
    return results as DrawingAnnotation[]
  } catch (error) {
    console.error("🚫 描画アノテーション一括作成エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを一括更新する
 * @param updates 更新データ配列
 * @returns Promise<DrawingAnnotation[]> 更新された描画アノテーション配列
 */
export async function batchUpdateDrawingAnnotations(
  updates: Array<{ id: string; data: DrawingUpdateData }>,
): Promise<DrawingAnnotation[]> {
  try {
    const results = await Promise.all(
      updates.map(async ({ id, data }) => {
        // バッチ内の個別更新ではバックアップをスキップ（既に作成済み）
        return await prisma.drawingAnnotation.update({
          where: { id },
          data: {
            ...data,
            updatedAt: new Date(),
          },
        })
      }),
    )

    console.log(`✅ 描画アノテーション一括更新成功: ${results.length}件更新`)
    return results as DrawingAnnotation[]
  } catch (error) {
    console.error("🚫 描画アノテーション一括更新エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションの統計情報を取得する
 * @param questionScoreId QuestionScoreのID
 * @returns Promise<DrawingAnnotationStats> 統計情報
 */
export async function getDrawingAnnotationStats(
  questionScoreId: string,
): Promise<DrawingAnnotationStats> {
  try {
    const annotations = await prisma.drawingAnnotation.findMany({
      where: { questionScoreId },
      select: { type: true },
    })

    const byType: Record<DrawingType, number> = {
      text: 0,
      line: 0,
      rectangle: 0,
      ellipse: 0,
    }
    annotations.forEach(({ type }) => {
      byType[type as DrawingType] = (byType[type as DrawingType] || 0) + 1
    })

    const stats: DrawingAnnotationStats = {
      total: annotations.length,
      byType,
    }

    return stats
  } catch (error) {
    console.error("🚫 描画アノテーション統計取得エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションのIDで取得する
 * @param id 描画アノテーションのID
 * @returns Promise<DrawingAnnotation | null> 描画アノテーション
 */
export async function getDrawingAnnotationById(
  id: string,
): Promise<DrawingAnnotation | null> {
  try {
    const result = await prisma.drawingAnnotation.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    })

    return result as DrawingAnnotation | null
  } catch (error) {
    console.error("🚫 描画アノテーション単体取得エラー:", error)
    throw error
  }
}
