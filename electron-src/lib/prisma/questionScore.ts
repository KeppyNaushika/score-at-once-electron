import { Decimal } from "@prisma/client/runtime/client"

import { type AuditChange, recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion, resolveStudentLabel } from "./auditScope"
import prisma from "./client"
import { recordDrawingAnnotationDeletionsForQuestionScores } from "./deletedRecord"

/** QuestionScore.status を日本語表示に変換（監査ログ差分用） */
const scoreStatusLabel = (s: string | null | undefined): string => {
  switch (s) {
    case "correct":
      return "正解"
    case "incorrect":
      return "不正解"
    case "partial":
      return "部分点"
    case "pending":
      return "保留"
    case "no_answer":
      return "無答"
    case "double_mark":
      return "複数マーク"
    case "unscored":
      return "未採点"
    default:
      return s ?? "（なし）"
  }
}

/** 採点提案の監査ログを記録（ベストエフォート） */
async function recordScoreAudit(opts: {
  action: "exam.score.propose" | "exam.score.update" | "exam.score.delete"
  scoreId: string
  cropRegionId: string
  studentId: string
  userId: string
  changes?: AuditChange[]
}): Promise<void> {
  const scope = await resolveExamScopeByCropRegion(opts.cropRegionId)
  const studentLabel = await resolveStudentLabel(opts.studentId)
  const verb =
    opts.action === "exam.score.propose"
      ? "提案しました"
      : opts.action === "exam.score.delete"
        ? "削除しました"
        : "変更しました"
  await recordAuditLog({
    action: opts.action,
    userId: opts.userId,
    entityType: "QuestionScore",
    entityId: opts.scoreId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: studentLabel
      ? `「${studentLabel}」の採点を${verb}`
      : `採点を${verb}`,
    changes: opts.changes,
  })
}

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
      return maxScore
    case "final":
      // 廃止済みstatus。未変換の旧データへの耐性として残す
      // （確定値は partialScore、満点確定時は null のことがある）
      return questionScore.partialScore !== null &&
        questionScore.partialScore !== undefined
        ? Number(questionScore.partialScore)
        : maxScore
    case "incorrect":
    case "no_answer":
    case "double_mark":
      return 0 // 誤答・無答・Wマークは 0/配点 と表示
    case "unscored":
      return null // 未採点は null を返して -/配点 と表示
    case "partial":
    case "pending":
    case "proposed": // 廃止済みstatus（旧データ耐性）
      return questionScore.partialScore !== null &&
        questionScore.partialScore !== undefined
        ? Number(questionScore.partialScore)
        : null
    default:
      return 0
  }
}

// 採点データの型定義
// 注: "proposed"/"final" は廃止済み。QuestionScoreは常に採点者ごとの「提案」であり、
// 確定はScoreDecision（scoreDecision.ts）で表現する。
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
    | "double_mark"
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
    | "double_mark"
  comment?: string
  version?: number
}

/**
 * 試験の採点データを取得
 * @param examId 試験ID
 * @param userId 採点者のユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export const getQuestionScoresForExam = async (
  examId: string,
  userId?: string
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        cropRegion: {
          examPage: {
            examId,
          },
        },
        // userIdが指定されている場合、そのユーザーの採点データのみ取得
        ...(userId && { userId: userId }),
      },
      include: {
        student: true,
        cropRegion: {
          include: {
            examPage: true,
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
    console.error("Failed to get question scores for exam:", error)
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
 * 単一の採点データをIDで取得
 * @param id QuestionScoreのID
 */
export const getQuestionScoreById = async (id: string) => {
  try {
    const score = await prisma.questionScore.findUnique({
      where: { id },
      include: {
        student: true,
        cropRegion: true,
        user: true,
      },
    })

    if (!score) {
      return { success: false, error: "Question score not found" }
    }

    return { success: true, score }
  } catch (error) {
    console.error("Failed to get question score by id:", error)
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

      await recordScoreAudit({
        action: "exam.score.update",
        scoreId: updated.id,
        cropRegionId: data.cropRegionId,
        studentId: data.studentId,
        userId: data.userId,
        changes: [
          {
            field: "status",
            label: "採点",
            before: scoreStatusLabel(existing.status),
            after: scoreStatusLabel(data.status),
          },
          {
            field: "partialScore",
            label: "部分点",
            before:
              existing.partialScore != null
                ? Number(existing.partialScore)
                : null,
            after:
              data.partialScore != null && data.partialScore !== undefined
                ? data.partialScore
                : null,
          },
        ],
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

      await recordScoreAudit({
        action: "exam.score.propose",
        scoreId: created.id,
        cropRegionId: data.cropRegionId,
        studentId: data.studentId,
        userId: data.userId,
        changes: [
          {
            field: "status",
            label: "採点",
            before: null,
            after: scoreStatusLabel(data.status),
          },
        ],
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

    // 差分記録用に変更前を取得
    const before = await prisma.questionScore.findUnique({
      where: { id },
      select: { status: true, partialScore: true },
    })

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

    await recordScoreAudit({
      action: "exam.score.update",
      scoreId: updated.id,
      cropRegionId: updated.cropRegionId,
      studentId: updated.studentId,
      userId: updated.userId,
      changes: [
        {
          field: "status",
          label: "採点",
          before: scoreStatusLabel(before?.status),
          after: scoreStatusLabel(updated.status),
        },
        {
          field: "partialScore",
          label: "部分点",
          before:
            before?.partialScore != null ? Number(before.partialScore) : null,
          after:
            updated.partialScore != null ? Number(updated.partialScore) : null,
        },
      ],
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
    // 監査ログ用に削除前の情報を取得
    const before = await prisma.questionScore.findUnique({
      where: { id },
      select: {
        cropRegionId: true,
        studentId: true,
        userId: true,
        status: true,
      },
    })

    // cascade削除前にDrawingAnnotationのtombstoneを記録
    await recordDrawingAnnotationDeletionsForQuestionScores([id])

    await prisma.questionScore.delete({
      where: { id },
    })

    if (before) {
      await recordScoreAudit({
        action: "exam.score.delete",
        scoreId: id,
        cropRegionId: before.cropRegionId,
        studentId: before.studentId,
        userId: before.userId,
        changes: [
          {
            field: "status",
            label: "採点",
            before: scoreStatusLabel(before.status),
            after: null,
          },
        ],
      })
    }

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
 *
 * - proposedScores: 採点者ごとの提案（unscored を除く全行）
 * - decision: OWNER による確定（ScoreDecision）
 * - hasConflict: 提案同士の値が食い違っている、または確定後に新しい提案がある
 */
export const getQuestionScoreComparison = async (
  studentId: string,
  cropRegionId: string
) => {
  try {
    const [scores, decision] = await Promise.all([
      prisma.questionScore.findMany({
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
      }),
      prisma.scoreDecision.findUnique({
        where: {
          cropRegionId_studentId: { cropRegionId, studentId },
        },
        include: {
          decidedBy: true,
        },
      }),
    ])

    const proposedScores = scores.filter((s) => s.status !== "unscored")

    const first = proposedScores[0]
    const proposalsDisagree =
      proposedScores.length > 1 &&
      proposedScores.some(
        (s) =>
          s.status !== first.status ||
          Number(s.partialScore ?? NaN) !== Number(first.partialScore ?? NaN)
      )
    const decisionIsStale =
      decision !== null &&
      proposedScores.some((s) => s.updatedAt > decision.decidedAt)

    return {
      success: true,
      decision,
      proposedScores,
      hasConflict: proposalsDisagree || decisionIsStale,
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
 * 答案シートの採点進捗を取得
 * TODO: 新スキーマに合わせて再実装が必要
 */
export const getAnswerSheetProgress = async (_answerSheetId: string) => {
  console.warn("getAnswerSheetProgress function needs rewriting for new schema")
  return {
    success: false as const,
    error: "Function not yet updated for new schema",
  }
}

/**
 * 試験全体の採点進捗を取得
 */
export const getExamProgress = async (examId: string) => {
  try {
    // 答案画像が存在する生徒数を取得（設問一覧の進捗計算と同じロジック）
    const studentsWithAnswers = await prisma.studentAnswerImage.findMany({
      where: {
        examPage: { examId },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    })
    const totalStudents = studentsWithAnswers.length

    // 試験の採点領域数を取得
    const totalQuestions = await prisma.cropRegion.count({
      where: {
        examPage: {
          examId,
        },
        type: "QUESTION_ANSWER",
      },
    })

    const totalItems = totalStudents * totalQuestions

    if (totalItems === 0) {
      return {
        totalStudents,
        totalQuestions,
        totalItems: 0,
        scoredItems: 0,
        finalizedItems: 0,
        scoredPercentage: 0,
        finalizedPercentage: 0,
      }
    }

    const cropRegionFilter = {
      cropRegion: {
        examPage: { examId },
        type: "QUESTION_ANSWER" as const,
      },
    }

    // 採点済みの項目数を取得
    // correct/incorrect/no_answer/double_mark は無条件でカウント
    // partial/pending は partialScore が null でないもののみカウント
    const scoredItems = await prisma.questionScore.count({
      where: {
        ...cropRegionFilter,
        OR: [
          {
            status: {
              in: ["correct", "incorrect", "no_answer", "double_mark"],
            },
          },
          {
            status: { in: ["partial", "pending"] },
            partialScore: { not: null },
          },
        ],
      },
    })

    // 最終確定の項目数を取得
    // correct/incorrect/no_answer/double_mark は無条件でカウント
    // partial は partialScore が null でないもののみカウント（pendingは未確定なので除外）
    const finalizedItems = await prisma.questionScore.count({
      where: {
        ...cropRegionFilter,
        OR: [
          {
            status: {
              in: ["correct", "incorrect", "no_answer", "double_mark"],
            },
          },
          {
            status: "partial",
            partialScore: { not: null },
          },
        ],
      },
    })

    return {
      totalStudents,
      totalQuestions,
      totalItems,
      scoredItems,
      finalizedItems,
      scoredPercentage:
        Math.round((scoredItems / totalItems) * 100 * 100) / 100,
      finalizedPercentage:
        Math.round((finalizedItems / totalItems) * 100 * 100) / 100,
    }
  } catch (error) {
    console.error("Error getting exam progress:", error)
    return {
      totalStudents: 0,
      totalQuestions: 0,
      totalItems: 0,
      scoredItems: 0,
      finalizedItems: 0,
      scoredPercentage: 0,
      finalizedPercentage: 0,
    }
  }
}

export interface BatchScoreEntry {
  studentId: string
  cropRegionId: string
  status: string
  partialScore: number | null
  userId: string
}

/** 採点データをトランザクション内で一括upsertする（OMR自動採点結果の反映用） */
export async function batchUpdateQuestionScores(
  entries: BatchScoreEntry[]
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    let updatedCount = 0

    // トランザクション内で一括処理
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        // 既存レコードを検索
        const existing = await tx.questionScore.findFirst({
          where: {
            studentId: entry.studentId,
            cropRegionId: entry.cropRegionId,
            userId: entry.userId,
          },
        })

        if (existing) {
          await tx.questionScore.update({
            where: { id: existing.id },
            data: {
              status: entry.status,
              partialScore:
                entry.partialScore !== null
                  ? new Decimal(entry.partialScore)
                  : null,
            },
          })
        } else {
          await tx.questionScore.create({
            data: {
              studentId: entry.studentId,
              cropRegionId: entry.cropRegionId,
              userId: entry.userId,
              status: entry.status,
              partialScore:
                entry.partialScore !== null
                  ? new Decimal(entry.partialScore)
                  : null,
            },
          })
        }
        updatedCount++
      }
    })

    // 監査ログ: 一括反映（OMR自動採点等）。1件にまとめて記録する。
    if (entries.length > 0) {
      const scope = await resolveExamScopeByCropRegion(entries[0].cropRegionId)
      await recordAuditLog({
        action: "exam.score.batch",
        userId: entries[0].userId,
        entityType: "QuestionScore",
        entityId: entries[0].cropRegionId,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        summary: `採点を一括反映しました（${updatedCount}件）`,
        extra: { count: updatedCount },
      })
    }

    return { success: true, updatedCount }
  } catch (error) {
    console.error("Error batch updating question scores:", error)
    return {
      success: false,
      updatedCount: 0,
      error: error instanceof Error ? error.message : "一括更新に失敗しました",
    }
  }
}
