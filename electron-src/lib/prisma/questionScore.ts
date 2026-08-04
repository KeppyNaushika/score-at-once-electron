import { Decimal } from "@prisma/client/runtime/client"

import { type AuditChange, recordAuditLog } from "./auditLog"
import {
  resolveExamScopeByCropRegion,
  resolveExamStudentLabel,
} from "./auditScope"
import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"
import { isRecordNotFoundError } from "./prismaErrors"

/**
 * 採点対象が既に無いことを表す機械可読な理由コード。
 *
 * 協調採点では、ある教員が答案画像を削除するとその答案の QuestionScore も同時に消える
 * （deleteStudentAnswer）。同じマスを開いていた別教員の保存は id 指定なので必ず失敗するため、
 * 呼び出し側が「保存失敗」と「答案が消えた」を区別できるようにする。
 */
export const SCORE_TARGET_DELETED = "target-deleted" as const

/** 上記を利用者へ伝える文言（renderer はこれをそのまま表示してよい） */
const SCORE_TARGET_DELETED_MESSAGE =
  "この答案は削除されたため採点を保存できません"

/** QuestionScore.status を日本語表示に変換（監査ログ差分用） */
const scoreStatusLabel = (status: string | null | undefined): string => {
  switch (status) {
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
      return status ?? "（なし）"
  }
}

/** 採点提案の監査ログを記録（ベストエフォート） */
async function recordScoreAudit(opts: {
  action: "exam.score.propose" | "exam.score.update" | "exam.score.delete"
  scoreId: string
  cropRegionId: string
  examStudentId: string
  userId: string
  changes?: AuditChange[]
}): Promise<void> {
  const scope = await resolveExamScopeByCropRegion(opts.cropRegionId)
  const studentLabel = await resolveExamStudentLabel(opts.examStudentId)
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

// 採点データの型定義
// 注: "proposed"/"final" は廃止済み。QuestionScoreは常に採点者ごとの「提案」であり、
// 確定はScoreDecision（scoreDecision.ts）で表現する。
export interface CreateQuestionScoreData {
  examStudentId: string
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
        examStudent: { include: { student: true } },
        cropRegion: {
          include: {
            examPage: true,
          },
        },
        user: true,
      },
      orderBy: [
        { examStudent: { student: { lastName: "asc" } } },
        { examStudent: { student: { firstName: "asc" } } },
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
 * 特定の受験者の採点データを取得
 * @param examStudentId 試験の受験者ID（ExamStudent.id）
 * @param userId 採点者のユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export const getQuestionScoresForExamStudent = async (
  examStudentId: string,
  userId?: string
) => {
  try {
    const scores = await prisma.questionScore.findMany({
      where: {
        examStudentId,
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
        examStudent: { include: { student: true } },
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
    // 採点領域と受験者が同じ試験のものであること（FK は片方ずつしか見ない）
    await assertCropRegionsInSameExam([
      {
        cropRegionId: data.cropRegionId,
        examStudentId: data.examStudentId,
      },
    ])

    // 同じ生徒・設問・採点者の組み合わせで既存レコードをチェック
    const existing = await prisma.questionScore.findFirst({
      where: {
        examStudentId: data.examStudentId,
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
          examStudent: { include: { student: true } },
          cropRegion: true,
          user: true,
        },
      })

      await recordScoreAudit({
        action: "exam.score.update",
        scoreId: updated.id,
        cropRegionId: data.cropRegionId,
        examStudentId: data.examStudentId,
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
          examStudentId: data.examStudentId,
          cropRegionId: data.cropRegionId,
          partialScore:
            data.partialScore !== null && data.partialScore !== undefined
              ? new Decimal(data.partialScore)
              : null,
          status: data.status,
          userId: data.userId,
        },
        include: {
          examStudent: { include: { student: true } },
          cropRegion: true,
          user: true,
        },
      })

      await recordScoreAudit({
        action: "exam.score.propose",
        scoreId: created.id,
        cropRegionId: data.cropRegionId,
        examStudentId: data.examStudentId,
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
        return {
          success: false,
          reason: SCORE_TARGET_DELETED,
          error: SCORE_TARGET_DELETED_MESSAGE,
        }
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

    // 差分記録用に変更前を取得。ここで無ければ答案ごと削除された後なので、
    // 生の Prisma エラーではなく「削除済み」として返す（協調採点で他教員が削除した場合）。
    const before = await prisma.questionScore.findUnique({
      where: { id },
    })

    if (!before) {
      return {
        success: false,
        reason: SCORE_TARGET_DELETED,
        error: SCORE_TARGET_DELETED_MESSAGE,
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
      },
      include: {
        examStudent: { include: { student: true } },
        cropRegion: true,
        user: true,
      },
    })

    await recordScoreAudit({
      action: "exam.score.update",
      scoreId: updated.id,
      cropRegionId: updated.cropRegionId,
      examStudentId: updated.examStudentId,
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
    // 上の存在チェックとの隙間で削除された場合（P2025: 更新対象が無い）
    if (isRecordNotFoundError(error)) {
      return {
        success: false,
        reason: SCORE_TARGET_DELETED,
        error: SCORE_TARGET_DELETED_MESSAGE,
      }
    }
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
    })

    await prisma.questionScore.delete({
      where: { id },
    })

    if (before) {
      await recordScoreAudit({
        action: "exam.score.delete",
        scoreId: id,
        cropRegionId: before.cropRegionId,
        examStudentId: before.examStudentId,
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

export interface BatchScoreEntry {
  examStudentId: string
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

    // 採点領域と受験者が同じ試験のものであること（FK は片方ずつしか見ない）
    await assertCropRegionsInSameExam(entries)

    // トランザクション内で一括処理
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        // 既存レコードを検索
        const existing = await tx.questionScore.findFirst({
          where: {
            examStudentId: entry.examStudentId,
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
              examStudentId: entry.examStudentId,
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
