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
  maxScore: number
): number | null => {
  switch (questionScore.status) {
    case "correct":
    case "final":
      return maxScore
    case "incorrect":
    case "no_answer":
      return 0 // 誤答・無答は 0/配点 と表示
    case "unscored":
      return null // 未採点は null を返して -/配点 と表示
    case "partial":
    case "pending":
    case "proposed":
      return questionScore.partialScore !== null &&
        questionScore.partialScore !== undefined
        ? Number(questionScore.partialScore)
        : null
    default:
      return 0
  }
}

// 採点データの型定義
export interface CreateQuestionScoreData {
  studentId: string
  cropRegionId: string
  partialScore?: number // 部分点・保留時のみ使用
  status:
    | "unscored"
    | "correct"
    | "incorrect"
    | "partial"
    | "pending"
    | "no_answer"
    | "proposed"
    | "final"
  comment?: string
  userId: string
}

export interface UpdateQuestionScoreData {
  partialScore?: number // 部分点・保留時のみ使用
  status?:
    | "unscored"
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
 * プロジェクトの採点データを取得
 * @param projectId プロジェクトID
 * @param userId 採点者のユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export const getQuestionScoresForProject = async (
  projectId: string,
  userId?: string
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        cropRegion: {
          projectPage: {
            projectId,
          },
        },
        // userIdが指定されている場合、そのユーザーの採点データのみ取得
        ...(userId && { userId: userId }),
      },
      include: {
        student: true,
        cropRegion: {
          include: {
            projectPage: true,
          },
        },
        user: true,
      },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
        { cropRegion: { orderIndex: "asc" } },
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
 * 特定の生徒の採点データを取得
 * @param studentId 生徒ID
 * @param userId 採点者のユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export const getQuestionScoresForStudent = async (
  studentId: string,
  userId?: string
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        studentId: studentId,
        // userIdが指定されている場合、そのユーザーの採点データのみ取得
        ...(userId && { userId: userId }),
      },
      include: {
        cropRegion: true,
        user: true,
      },
      orderBy: {
        cropRegion: { orderIndex: "asc" },
      },
    })

    return { success: true, scores }
  } catch (error) {
    console.error("Failed to get question scores for student:", error)
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
    // 同じ生徒・設問・採点者の組み合わせで既存レコードをチェック
    const existing = await prisma.questionScore.findFirst({
      where: {
        studentId: data.studentId,
        cropRegionId: data.cropRegionId,
        userId: data.userId,
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
        },
        include: {
          student: true,
          cropRegion: true,
          user: true,
        },
      })
      return { success: true, score: updated }
    } else {
      // 新規作成
      const created = await prisma.questionScore.create({
        data: {
          studentId: data.studentId,
          cropRegionId: data.cropRegionId,
          partialScore:
            data.partialScore !== null && data.partialScore !== undefined
              ? new Decimal(data.partialScore)
              : null,
          status: data.status,
          userId: data.userId,
        },
        include: {
          student: true,
          cropRegion: true,
          user: true,
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
  expectedVersion?: number
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

      // Version checking removed - scoreVersion field doesn't exist in new schema
      // TODO: Implement optimistic locking with a different approach if needed
      /*
      if (current.scoreVersion !== expectedVersion) {
        return {
          success: false,
          error:
            "Version conflict: The score has been modified by another user",
          conflictData: current,
        }
      }
      */
    }

    const updated = await prisma.questionScore.update({
      where: { id },
      data: {
        partialScore:
          data.partialScore !== null && data.partialScore !== undefined
            ? new Decimal(data.partialScore)
            : null,
        status: data.status,
      },
      include: {
        student: true,
        cropRegion: true,
        user: true,
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
  studentId: string,
  cropRegionId: string
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        studentId: studentId,
        cropRegionId: cropRegionId,
      },
      include: {
        user: true,
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
  studentId: string,
  cropRegionId: string,
  userId: string,
  scoreData: {
    partialScore?: number // 部分点・保留の場合のみ
    status: string
    comment?: string
  }
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // 既存の最終決定レコードを削除
      await tx.questionScore.deleteMany({
        where: {
          studentId: studentId,
          cropRegionId: cropRegionId,
          status: "final",
        },
      })

      // 新しい最終決定レコードを作成
      const finalScore = await tx.questionScore.create({
        data: {
          studentId: studentId,
          cropRegionId: cropRegionId,
          partialScore:
            scoreData.partialScore !== null &&
            scoreData.partialScore !== undefined
              ? new Decimal(scoreData.partialScore)
              : null,
          status: scoreData.status,
          userId,
        },
        include: {
          student: true,
          cropRegion: true,
          user: true,
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
export const getAnswerSheetProgress = async (_answerSheetId: string) => {
  try {
    // TODO: This function needs to be rewritten for new schema
    // In new schema, there's no direct answerSheet table
    // Need to get student and project info differently
    console.warn(
      "getAnswerSheetProgress function needs rewriting for new schema"
    )
    return {
      success: false,
      error: "Function not yet updated for new schema",
    }

    /* Old code - needs rewriting:
    const answerSheet = await prisma.pageImage.findUnique({
      where: { id: answerSheetId },
      include: {
        projectPage: {
          include: {
            project: {
          include: {
            cropRegions: {
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

    const totalQuestions = answerSheet.project.cropRegions.length

    // 採点済み設問数を取得（finalまたはproposedステータス）
    const gradedQuestionsCount = await prisma.questionScore.groupBy({
      by: ["cropRegionId"],
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
    */
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
    // プロジェクトに参加している生徒数を取得
    const totalAnswerSheets = await prisma.projectStudent.count({
      where: { projectId },
    })

    if (totalAnswerSheets === 0) {
      return {
        totalAnswerSheets: 0,
        completedAnswerSheets: 0,
        percentage: 0,
      }
    }

    // プロジェクトの採点領域数を取得
    const totalCropRegions = await prisma.cropRegion.count({
      where: {
        projectPage: {
          projectId,
        },
        type: "QUESTION_ANSWER",
      },
    })

    if (totalCropRegions === 0) {
      return {
        totalAnswerSheets,
        completedAnswerSheets: 0,
        percentage: 0,
      }
    }

    // 各生徒の採点完了状況を確認
    const projectStudents = await prisma.projectStudent.findMany({
      where: { projectId },
      select: { studentId: true },
    })

    let completedAnswerSheets = 0

    for (const projectStudent of projectStudents) {
      // この生徒の採点済み設問数を取得
      const completedQuestions = await prisma.questionScore.count({
        where: {
          studentId: projectStudent.studentId,
          cropRegion: {
            projectPage: {
              projectId,
            },
            type: "QUESTION_ANSWER",
          },
          OR: [{ status: "final" }, { status: "proposed" }],
        },
      })

      // 全設問が採点済みの場合、完了とみなす
      if (completedQuestions >= totalCropRegions) {
        completedAnswerSheets++
      }
    }

    const percentage =
      totalAnswerSheets > 0
        ? (completedAnswerSheets / totalAnswerSheets) * 100
        : 0

    return {
      totalAnswerSheets,
      completedAnswerSheets,
      percentage: Math.round(percentage * 100) / 100, // 小数点2位まで
    }
  } catch (error) {
    console.error("Error getting project progress:", error)
    return {
      totalAnswerSheets: 0,
      completedAnswerSheets: 0,
      percentage: 0,
    }
  }
}
