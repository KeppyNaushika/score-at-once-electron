/**
 * @fileoverview 描画アノテーション データベースサービス
 * @description 全描画ツールの統合CRUD操作（自動バックアップ付き）
 */

import type {
  DrawingAnnotation,
  DrawingAnnotationStats,
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "../../../types/drawingAnnotation.types"
import prisma from "./client"

/**
 * 描画アノテーションを作成する
 * @param data 作成データ（questionScoreIdは必須）
 * @returns Promise<DrawingAnnotation> 作成された描画アノテーション
 */
export async function createDrawingAnnotation(
  data: DrawingCreateData
): Promise<DrawingAnnotation> {
  try {
    // questionScoreIdは必須
    if (!data.questionScoreId) {
      throw new Error(
        "questionScoreId is required. QuestionScore must be created before adding annotations."
      )
    }

    // 外部キー制約の事前検証
    const questionScoreExists = await prisma.questionScore.findUnique({
      where: { id: data.questionScoreId },
      select: { id: true },
    })

    if (!questionScoreExists) {
      throw new Error(`QuestionScore not found: ${data.questionScoreId}`)
    }

    // ユーザー存在チェック
    if (!data.userId) {
      throw new Error("userId is required but was undefined/null")
    }

    const userExists = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true },
    })

    if (!userExists) {
      throw new Error(`User not found: ${data.userId}`)
    }

    const result = await prisma.drawingAnnotation.create({
      data: {
        // フロントエンドで生成したIDがあれば使用、なければPrismaが自動生成
        ...(data.id && { id: data.id }),
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
        // V4統合フィールド
        anchorDirection: data.anchorDirection || "top-left",
        // 表示プロパティ
        displayX: data.displayX || 0.0,
        displayY: data.displayY || 0.0,
        // メタデータ
        userId: data.userId,
      },
      // 透明度制御に必要なquestionScore情報を含める
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        questionScore: {
          select: {
            id: true,
            cropRegionId: true,
            cropRegion: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
    })

    return result as DrawingAnnotation
  } catch (error) {
    console.error("描画アノテーション作成エラー:", error)
    throw error
  }
}

/**
 * QuestionScoreに紐づく描画アノテーションを取得する
 * @param questionScoreId QuestionScoreのID
 * @param type フィルタする描画タイプ（オプション）
 * @param userId 作成者のユーザーID（指定時はそのユーザーのアノテーションのみ取得）
 * @returns Promise<DrawingAnnotation[]> 描画アノテーション配列
 */
export async function getDrawingAnnotationsByQuestionScore(
  questionScoreId: string,
  type?: DrawingType,
  userId?: string
): Promise<DrawingAnnotation[]> {
  // 読み取り専用操作のためバックアップ不要
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScoreId,
        ...(type && { type }),
        // userIdが指定されている場合、そのユーザーのアノテーションのみ取得
        ...(userId && { userId }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
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
    console.error("描画アノテーション取得エラー:", error)
    throw error
  }
}

/**
 * 特定の学生・試験の全描画アノテーションを取得する（透明度制御用）
 * @param studentId 学生ID
 * @param examId 試験ID
 * @param type フィルタする描画タイプ（オプション）
 * @param userId 作成者のユーザーID（指定時はそのユーザーのアノテーションのみ取得）
 * @returns Promise<DrawingAnnotationWithQuestionScore[]> 描画アノテーション配列（設問情報付き）
 */
export async function getDrawingAnnotationsByStudent(
  studentId: string,
  examId: string,
  type?: DrawingType,
  userId?: string
): Promise<DrawingAnnotation[]> {
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScore: {
          studentId: studentId,
          cropRegion: {
            examPage: {
              examId: examId,
            },
          },
        },
        ...(type && { type }),
        // userIdが指定されている場合、そのユーザーのアノテーション、または作成者不明（null）のものを取得
        ...(userId && {
          userId,
        }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        questionScore: {
          select: {
            id: true,
            cropRegionId: true,
            cropRegion: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
    })

    return result as DrawingAnnotation[]
  } catch (error) {
    console.error("学生別描画アノテーション取得エラー:", error)
    throw error
  }
}

/**
 * 試験全体の描画アノテーションを取得する（PDF出力用）
 * @param examId 試験ID
 * @param type フィルタする描画タイプ（オプション）
 * @param userId 作成者のユーザーID（指定時はそのユーザーのアノテーションのみ取得）
 * @returns Promise<DrawingAnnotation[]> 描画アノテーション配列（設問情報付き）
 */
export async function getDrawingAnnotationsByExam(
  examId: string,
  type?: DrawingType,
  userId?: string
): Promise<DrawingAnnotation[]> {
  try {
    const result = await prisma.drawingAnnotation.findMany({
      where: {
        questionScore: {
          cropRegion: {
            examPage: {
              examId: examId,
            },
          },
        },
        ...(type && { type }),
        // userIdが指定されている場合、そのユーザーのアノテーション、または作成者不明（null）のものを取得
        ...(userId && {
          userId,
        }),
      },
      orderBy: [
        { questionScore: { studentId: "asc" } },
        { questionScore: { cropRegionId: "asc" } },
        { createdAt: "asc" },
      ],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        questionScore: {
          select: {
            id: true,
            studentId: true,
            cropRegionId: true,
            cropRegion: {
              select: {
                id: true,
                label: true,
              },
            },
            student: {
              select: {
                id: true,
                studentNumber: true,
                lastName: true,
                firstName: true,
              },
            },
          },
        },
      },
    })

    return result as DrawingAnnotation[]
  } catch (error) {
    console.error("試験別描画アノテーション取得エラー:", error)
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
  data: DrawingUpdateData
): Promise<DrawingAnnotation> {
  try {
    const result = await prisma.drawingAnnotation.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      // 透明度制御に必要なquestionScore情報を含める
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        questionScore: {
          select: {
            id: true,
            cropRegionId: true,
            cropRegion: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
    })

    return result as DrawingAnnotation
  } catch (error) {
    console.error("描画アノテーション更新エラー:", error)
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
  } catch (error) {
    console.error("描画アノテーション削除エラー:", error)
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
  type?: DrawingType
): Promise<void> {
  try {
    await prisma.drawingAnnotation.deleteMany({
      where: {
        questionScoreId,
        ...(type && { type }),
      },
    })
  } catch (error) {
    console.error("描画アノテーション一括削除エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを一括作成する
 * @param annotations 作成する描画アノテーション配列
 * @returns Promise<DrawingAnnotation[]> 作成された描画アノテーション配列
 */
export async function batchCreateDrawingAnnotations(
  annotations: DrawingCreateData[]
): Promise<DrawingAnnotation[]> {
  try {
    // 各アノテーションに対してcreateDrawingAnnotation関数を使用（QuestionScore自動作成機能を含む）
    const results = await Promise.all(
      annotations.map(async (data) => {
        return await createDrawingAnnotation(data)
      })
    )

    return results as DrawingAnnotation[]
  } catch (error) {
    console.error("描画アノテーション一括作成エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションを一括更新する
 * @param updates 更新データ配列
 * @returns Promise<DrawingAnnotation[]> 更新された描画アノテーション配列
 */
export async function batchUpdateDrawingAnnotations(
  updates: Array<{ id: string; data: DrawingUpdateData }>
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
          // 透明度制御に必要なquestionScore情報を含める
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
            questionScore: {
              select: {
                id: true,
                cropRegionId: true,
                cropRegion: {
                  select: {
                    id: true,
                    label: true,
                  },
                },
              },
            },
          },
        })
      })
    )

    return results as DrawingAnnotation[]
  } catch (error) {
    console.error("描画アノテーション一括更新エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションの統計情報を取得する
 * @param questionScoreId QuestionScoreのID
 * @returns Promise<DrawingAnnotationStats> 統計情報
 */
export async function getDrawingAnnotationStats(
  questionScoreId: string
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
    console.error("描画アノテーション統計取得エラー:", error)
    throw error
  }
}

/**
 * 描画アノテーションのIDで取得する
 * @param id 描画アノテーションのID
 * @returns Promise<DrawingAnnotation | null> 描画アノテーション
 */
export async function getDrawingAnnotationById(
  id: string
): Promise<DrawingAnnotation | null> {
  try {
    const result = await prisma.drawingAnnotation.findUnique({
      where: { id },
      include: {
        user: {
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
    console.error("描画アノテーション単体取得エラー:", error)
    throw error
  }
}
