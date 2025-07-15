import { Decimal } from "@prisma/client/runtime/library"
import prisma from "./client"

/**
 * 実際の得点を計算する関数
 * @param questionScore 採点データ
 * @param maxScore 配点
 * @returns 実際の得点
 */
export const calculateActualScore = (
  questionScore: { status: string; partialScore?: number | null },
  maxScore: number,
): number | null => {
  switch (questionScore.status) {
    case "correct":
    case "final":
      return maxScore
    case "incorrect":
    case "no_answer":
      return 0 // 誤答・無答は 0/配点 と表示
    case "ungraded":
      return null // 未採点は null を返して -/配点 と表示
    case "partial":
    case "pending":
    case "proposed":
      return questionScore.partialScore
        ? Number(questionScore.partialScore)
        : null
    default:
      return 0
  }
}

// 採点データの型定義
export interface CreateQuestionScoreData {
  answerSheetId: string
  layoutRegionId: string
  partialScore?: number // 部分点・保留時のみ使用
  status:
    | "ungraded"
    | "correct"
    | "incorrect"
    | "partial"
    | "pending"
    | "no_answer"
    | "proposed"
    | "final"
  comment?: string
  scoredByUserId: string
}

export interface UpdateQuestionScoreData {
  partialScore?: number // 部分点・保留時のみ使用
  status?:
    | "ungraded"
    | "correct"
    | "incorrect"
    | "partial"
    | "pending"
    | "no_answer"
    | "proposed"
    | "final"
  comment?: string
  version?: number
}

/**
 * プロジェクトの全採点データを取得
 */
export const getQuestionScoresForProject = async (projectId: string) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        answerSheet: {
          projectId,
        },
      },
      include: {
        answerSheet: {
          include: {
            student: true,
          },
        },
        layoutRegion: true,
        scoredByUser: true,
      },
      orderBy: [
        { answerSheet: { student: { lastName: "asc" } } },
        { answerSheet: { student: { firstName: "asc" } } },
        { layoutRegion: { orderIndex: "asc" } },
      ],
    })

    return { success: true, scores }
  } catch (error) {
    console.error("Failed to get question scores for project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 特定の答案シートの採点データを取得
 */
export const getQuestionScoresForAnswerSheet = async (
  answerSheetId: string,
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        answerSheetId,
      },
      include: {
        layoutRegion: true,
        scoredByUser: true,
      },
      orderBy: {
        layoutRegion: { orderIndex: "asc" },
      },
    })

    return { success: true, scores }
  } catch (error) {
    console.error("Failed to get question scores for answer sheet:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 採点データを作成
 */
export const createQuestionScore = async (data: CreateQuestionScoreData) => {
  try {
    // 同じ答案・設問・採点者の組み合わせで既存レコードをチェック
    const existing = await prisma.questionScore.findFirst({
      where: {
        answerSheetId: data.answerSheetId,
        layoutRegionId: data.layoutRegionId,
        scoredByUserId: data.scoredByUserId,
      },
    })

    if (existing) {
      // 既存レコードを更新
      const updated = await prisma.questionScore.update({
        where: { id: existing.id },
        data: {
          partialScore:
            data.partialScore !== null && data.partialScore !== undefined
              ? new Decimal(data.partialScore)
              : null,
          status: data.status,
          comment: data.comment,
          scoreVersion: existing.scoreVersion + 1,
        },
        include: {
          answerSheet: {
            include: {
              student: true,
            },
          },
          layoutRegion: true,
          scoredByUser: true,
        },
      })
      return { success: true, score: updated }
    } else {
      // 新規作成
      const created = await prisma.questionScore.create({
        data: {
          answerSheetId: data.answerSheetId,
          layoutRegionId: data.layoutRegionId,
          partialScore:
            data.partialScore !== null && data.partialScore !== undefined
              ? new Decimal(data.partialScore)
              : null,
          status: data.status,
          comment: data.comment,
          scoredByUserId: data.scoredByUserId,
          scoreVersion: 1,
        },
        include: {
          answerSheet: {
            include: {
              student: true,
            },
          },
          layoutRegion: true,
          scoredByUser: true,
        },
      })
      return { success: true, score: created }
    }
  } catch (error) {
    console.error("Failed to create question score:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 採点データを更新（楽観的ロック対応）
 */
export const updateQuestionScore = async (
  id: string,
  data: UpdateQuestionScoreData,
  expectedVersion?: number,
) => {
  try {
    // 楽観的ロックのチェック
    if (expectedVersion !== undefined) {
      const current = await prisma.questionScore.findUnique({
        where: { id },
      })

      if (!current) {
        return { success: false, error: "Question score not found" }
      }

      if (current.scoreVersion !== expectedVersion) {
        return {
          success: false,
          error:
            "Version conflict: The score has been modified by another user",
          conflictData: current,
        }
      }
    }

    const updated = await prisma.questionScore.update({
      where: { id },
      data: {
        partialScore:
          data.partialScore !== null && data.partialScore !== undefined
            ? new Decimal(data.partialScore)
            : null,
        status: data.status,
        comment: data.comment,
        scoreVersion: { increment: 1 },
      },
      include: {
        answerSheet: {
          include: {
            student: true,
          },
        },
        layoutRegion: true,
        scoredByUser: true,
      },
    })

    return { success: true, score: updated }
  } catch (error) {
    console.error("Failed to update question score:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 採点データを削除
 */
export const deleteQuestionScore = async (id: string) => {
  try {
    await prisma.questionScore.delete({
      where: { id },
    })

    return { success: true }
  } catch (error) {
    console.error("Failed to delete question score:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 複数教員の採点結果を比較するためのデータを取得
 */
export const getQuestionScoreComparison = async (
  answerSheetId: string,
  layoutRegionId: string,
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        answerSheetId,
        layoutRegionId,
      },
      include: {
        scoredByUser: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    // finalとproposedに分類
    const finalScore = scores.find((s) => s.status === "final")
    const proposedScores = scores.filter((s) => s.status === "proposed")

    return {
      success: true,
      finalScore,
      proposedScores,
      hasConflict:
        proposedScores.length > 1 || (finalScore && proposedScores.length > 0),
    }
  } catch (error) {
    console.error("Failed to get question score comparison:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 採点結果を最終決定として確定
 */
export const finalizeQuestionScore = async (
  answerSheetId: string,
  layoutRegionId: string,
  scoredByUserId: string,
  scoreData: {
    partialScore?: number // 部分点・保留の場合のみ
    status: string
    comment?: string
  },
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // 既存の最終決定レコードを削除
      await tx.questionScore.deleteMany({
        where: {
          answerSheetId,
          layoutRegionId,
          status: "final",
        },
      })

      // 新しい最終決定レコードを作成
      const finalScore = await tx.questionScore.create({
        data: {
          answerSheetId,
          layoutRegionId,
          partialScore:
            scoreData.partialScore !== null &&
            scoreData.partialScore !== undefined
              ? new Decimal(scoreData.partialScore)
              : null,
          status: scoreData.status,
          comment: scoreData.comment,
          scoredByUserId,
          scoreVersion: 1,
        },
        include: {
          answerSheet: {
            include: {
              student: true,
            },
          },
          layoutRegion: true,
          scoredByUser: true,
        },
      })

      return { success: true, score: finalScore }
    })
  } catch (error) {
    console.error("Failed to finalize question score:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 答案シートの採点進捗を取得
 */
export const getAnswerSheetProgress = async (answerSheetId: string) => {
  try {
    // この答案シートに関連する全設問を取得
    const answerSheet = await prisma.answerSheet.findUnique({
      where: { id: answerSheetId },
      include: {
        project: {
          include: {
            layoutRegions: {
              where: {
                type: "QUESTION_ANSWER",
              },
            },
          },
        },
      },
    })

    if (!answerSheet) {
      return { success: false, error: "Answer sheet not found" }
    }

    const totalQuestions = answerSheet.project.layoutRegions.length

    // 採点済み設問数を取得（finalまたはproposedステータス）
    const gradedQuestionsCount = await prisma.questionScore.groupBy({
      by: ["layoutRegionId"],
      where: {
        answerSheetId,
        OR: [{ status: "final" }, { status: "proposed" }],
      },
    })
    const gradedQuestions = gradedQuestionsCount.length

    // 最終決定済み設問数を取得
    const finalizedQuestions = await prisma.questionScore.count({
      where: {
        answerSheetId,
        status: "final",
      },
    })

    return {
      success: true,
      progress: {
        totalQuestions,
        gradedQuestions,
        finalizedQuestions,
        progressPercentage:
          totalQuestions > 0 ? (gradedQuestions / totalQuestions) * 100 : 0,
        finalizedPercentage:
          totalQuestions > 0 ? (finalizedQuestions / totalQuestions) * 100 : 0,
      },
    }
  } catch (error) {
    console.error("Failed to get answer sheet progress:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * プロジェクト全体の採点進捗を取得
 */
export const getProjectProgress = async (projectId: string) => {
  try {
    // プロジェクトの答案シートと設問を取得
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        answerSheets: true,
        layoutRegions: {
          where: {
            type: "QUESTION_ANSWER",
          },
        },
      },
    })

    if (!project) {
      return { success: false, error: "Project not found" }
    }

    const totalAnswerSheets = project.answerSheets.length
    const totalQuestions = project.layoutRegions.length
    const totalItems = totalAnswerSheets * totalQuestions

    if (totalItems === 0) {
      return {
        success: true,
        progress: {
          totalAnswerSheets,
          totalQuestions,
          totalItems: 0,
          gradedItems: 0,
          finalizedItems: 0,
          progressPercentage: 0,
          finalizedPercentage: 0,
        },
      }
    }

    // 採点済みアイテム数（finalまたはproposedステータス）
    const gradedItems = await prisma.questionScore.count({
      where: {
        answerSheet: {
          projectId,
        },
        OR: [{ status: "final" }, { status: "proposed" }],
      },
    })

    // 最終決定済みアイテム数
    const finalizedItems = await prisma.questionScore.count({
      where: {
        answerSheet: {
          projectId,
        },
        status: "final",
      },
    })

    return {
      success: true,
      progress: {
        totalAnswerSheets,
        totalQuestions,
        totalItems,
        gradedItems,
        finalizedItems,
        progressPercentage: (gradedItems / totalItems) * 100,
        finalizedPercentage: (finalizedItems / totalItems) * 100,
      },
    }
  } catch (error) {
    console.error("Failed to get project progress:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
