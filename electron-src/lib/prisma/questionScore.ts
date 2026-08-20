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

    return scores
  } catch (error) {
    console.error("Failed to get question scores for exam:", error)
    throw error
  }
}

/** `ensureQuestionScore` の引数。判定を持たない（採点する関数ではないので） */
export interface EnsureQuestionScoreData {
  examStudentId: string
  cropRegionId: string
  userId: string
}

/**
 * この組み合わせの採点行を用意する。**有れば何も書かずに、その行を返す。**
 *
 * 手書き注釈は `DrawingAnnotation.questionScoreId` を必須で持つので、注釈を
 * ぶら下げる先として行の実体が要る。**それがこの関数の唯一の存在理由**で、
 * 「未採点である」ことを記録するためではない — 行の不在は既にアプリ全体で
 * 未採点として読まれている（採点画面・確定リゾルバ・成績算出・出力の全経路。
 * docs/branch-review-findings.md #2）。
 *
 * **作るときも監査ログを残さない。** 利用者が行った操作ではなく、`unscored` は
 * 確定リゾルバが「採点の意思表示ではない」として読み飛ばすものなので、
 * 「採点を提案した」と記録すると監査ログが嘘をつく。
 *
 * この作成そのものを無くすのが段階21（注釈を書くときに main が用意する）。
 */
export const ensureQuestionScore = async (data: EnsureQuestionScoreData) => {
  try {
    await assertCropRegionsInSameExam([
      {
        cropRegionId: data.cropRegionId,
        examStudentId: data.examStudentId,
      },
    ])

    const include = {
      examStudent: { include: { student: true } },
      cropRegion: true,
      user: true,
    }

    const existing = await prisma.questionScore.findFirst({
      where: {
        examStudentId: data.examStudentId,
        cropRegionId: data.cropRegionId,
        userId: data.userId,
      },
      include,
    })
    // 有ったら触らない。ここで status を書くと、入れたばかりの採点が消える
    if (existing) return existing

    return await prisma.questionScore.create({
      data: {
        examStudentId: data.examStudentId,
        cropRegionId: data.cropRegionId,
        partialScore: null,
        status: "unscored",
        userId: data.userId,
      },
      include,
    })
  } catch (error) {
    console.error("Failed to ensure question score:", error)
    throw error
  }
}

/**
 * 採点する。**この組み合わせに行が無ければ作り、有れば上書きする。**
 *
 * `QuestionScore` には (examStudentId, cropRegionId, userId) の unique がいま無いので
 * `upsert()` が使えず、`findFirst` ＋ 分岐を手書きしている。**「1採点者・1セル・1行」を
 * 守っているのはこの関数だけ。**
 *
 * 無いのは規約が禁じているからではない。規約は「uuid 以外を unique にしない」で、
 * この3列はすべて uuid なので張ること自体は規約に反しない（張れば同期のマージが LWW で
 * 1行へ畳む）。ただし `QuestionScore` は子（`DrawingAnnotation`）を持つため、いま張ると
 * 衝突時に勝った端末が外部キー違反で詰まり、その相手からの以後すべての変更が届かなく
 * なる（docs/sync-secondary-unique-hazard.md §3）。段階20 が入るまでは張れず、実際に
 * 張るかどうかは段階30 で判断する。
 *
 * **「行が無いなら用意したい」だけのときは呼ばないこと。** 上書きが正しいのは
 * 利用者が採点したときだけで、置き場所が欲しいだけなら `ensureQuestionScore` を
 * 使う。かつてこの関数が `createQuestionScore` という名前で両方を兼ねており、
 * 設問を表示しただけで出る自動作成が、入れたばかりの採点を unscored で
 * 上書きしていた（docs/branch-review-findings.md #2）。
 */
export const setQuestionScore = async (data: CreateQuestionScoreData) => {
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

      return updated
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

      return created
    }
  } catch (error) {
    console.error("Failed to set question score:", error)
    throw error
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
        return { status: SCORE_TARGET_DELETED } as const
      }
    }

    // 差分記録用に変更前を取得。ここで無ければ答案ごと削除された後なので、
    // 生の Prisma エラーではなく「削除済み」として返す（協調採点で他教員が削除した場合）。
    const before = await prisma.questionScore.findUnique({
      where: { id },
    })

    if (!before) {
      return { status: SCORE_TARGET_DELETED } as const
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

    return { status: "saved", score: updated } as const
  } catch (error) {
    // 上の存在チェックとの隙間で削除された場合（P2025: 更新対象が無い）。
    // 協調採点で他教員が答案ごと消したケースで、保存の失敗とは区別する
    if (isRecordNotFoundError(error)) {
      return { status: SCORE_TARGET_DELETED } as const
    }
    throw error
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
): Promise<{ updatedCount: number }> {
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

    return { updatedCount }
  } catch (error) {
    console.error("Error batch updating question scores:", error)
    throw error
  }
}
