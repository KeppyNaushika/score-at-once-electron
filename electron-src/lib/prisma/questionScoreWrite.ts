/**
 * 採点行（QuestionScore）の書き込み。
 *
 * 採点する（`setQuestionScore` / `updateQuestionScore` / `batchUpdateQuestionScores`）と、
 * 注釈の置き場所として行を用意する（`ensureQuestionScore`）の2種類がある。
 * 読み取りは `questionScore.ts`、覚え書きは `questionScoreComment.ts` にある。
 */

import type { CropRegion, Prisma, Student } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/client"

import type { ScoringStatus } from "@/types/scoringStatus.types"

import { type AuditChange, recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import {
  cropRegionAuditTarget,
  studentAuditLabel,
  studentAuditTarget,
} from "./auditTargets"
import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"
import { isRecordNotFoundError } from "./prismaErrors"
import { PUBLIC_USER_OMIT } from "./publicUser"

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

/**
 * 採点提案の監査ログを記録（ベストエフォート）。
 *
 * 生徒と採点領域は、書き込みの `include` で既に取れている行をそのまま受け取る
 * （ここで取り直さない。採点はいちばん件数の多い操作で、1回ごとに1クエリ増える）。
 * 生徒と採点領域の両方を対象（`AuditLogTarget`）に付け、要約にも両方のラベルを載せる
 * （全文検索が「山田 太郎」「1-1」で引けるように）。
 */
async function recordScoreAudit(opts: {
  action: "exam.score.propose" | "exam.score.update" | "exam.score.delete"
  scoreId: string
  student: Student
  cropRegion: CropRegion
  userId: string
  changes?: AuditChange[]
}): Promise<void> {
  const scope = await resolveExamScopeByCropRegion(opts.cropRegion.id)
  const studentLabel = studentAuditLabel(opts.student)
  const regionLabel = opts.cropRegion.label
  const verb =
    opts.action === "exam.score.propose"
      ? "提案しました"
      : opts.action === "exam.score.delete"
        ? "削除しました"
        : "変更しました"
  const subject = [
    studentLabel && `「${studentLabel}」`,
    regionLabel && `「${regionLabel}」`,
  ]
    .filter(Boolean)
    .join("の")
  await recordAuditLog({
    action: opts.action,
    userId: opts.userId,
    entityType: "QuestionScore",
    entityId: opts.scoreId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: subject ? `${subject}の採点を${verb}` : `採点を${verb}`,
    changes: opts.changes,
    targets: [
      studentAuditTarget(opts.student),
      cropRegionAuditTarget(opts.cropRegion),
    ],
  })
}

/**
 * 「このマスの採点結果はこれだ」という**1つの決定**。
 *
 * 判定と部分点は利用者の1操作で一緒に決まる（数字キーはバッファに溜まるだけで、
 * F/J を押した瞬間に判定と点が同時に確定する）ので、割らずに**両方必須**で受ける。
 * optional にすると「省略＝消す」と「省略＝触らない」が同じ袋に混ざり、列ごとに
 * 意味が逆になる。正答にするときは `partialScore` に `null` を明示する。
 *
 * 注: "proposed"/"final" は廃止済み。QuestionScore は常に採点者ごとの「提案」であり、
 * 確定は ScoreDecision（scoreDecision.ts）で表現する。
 */
export interface QuestionScoreResult {
  status: ScoringStatus
  /** 部分点。判定そのものが点を決める（正解・不正解・無答など）ときは null */
  partialScore: number | null
}

/**
 * `setQuestionScore` / `batchUpdateQuestionScores` の引数。
 * 行の同定（受験者×設問×採点者）＋ 採点結果。
 *
 * 土台は Prisma の入力型で、**DB が決める列（id / createdAt / updatedAt）と、
 * ここでは書かない子（drawingAnnotations）を外し、Decimal と union だけを注入する**。
 * 列を手写しすると、渡しても何も起きない引数（かつての comment / version）が紛れ込む。
 */
export type SetQuestionScoreData = Omit<
  Prisma.QuestionScoreUncheckedCreateInput,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "drawingAnnotations"
  | "status"
  | "partialScore"
> &
  QuestionScoreResult

/** 部分点を Decimal 列の値へ。`null` はそのまま NULL を書く */
const toPartialScoreColumn = (partialScore: number | null): Decimal | null =>
  partialScore !== null ? new Decimal(partialScore) : null

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
 * 未採点として読まれている（採点画面・確定リゾルバ・成績算出・出力の全経路）。
 *
 * **呼ぶのは注釈の保存だけ**（`createDrawingAnnotation`）。IPC の口は持たない。
 * renderer から呼べるようにすると「表示したら書き込む」に戻り、設問をめくるだけで
 * 空行が量産される（段階21 でその経路を畳んだ）。
 *
 * **作るときも監査ログを残さない。** 利用者が行った操作ではなく、`unscored` は
 * 確定リゾルバが「採点の意思表示ではない」として読み飛ばすものなので、
 * 「採点を提案した」と記録すると監査ログが嘘をつく。
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
      user: { omit: PUBLIC_USER_OMIT },
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
 * 上書きしていた。
 */
export const setQuestionScore = async (questionScore: SetQuestionScoreData) => {
  try {
    // 採点領域と受験者が同じ試験のものであること（FK は片方ずつしか見ない）
    await assertCropRegionsInSameExam([
      {
        cropRegionId: questionScore.cropRegionId,
        examStudentId: questionScore.examStudentId,
      },
    ])

    // 同じ生徒・設問・採点者の組み合わせで既存レコードをチェック
    const existing = await prisma.questionScore.findFirst({
      where: {
        examStudentId: questionScore.examStudentId,
        cropRegionId: questionScore.cropRegionId,
        userId: questionScore.userId,
      },
    })

    if (existing) {
      // 既存レコードを更新。決定した2列だけを書く（行の同定に使った列は触らない）
      const updated = await prisma.questionScore.update({
        where: { id: existing.id },
        data: {
          partialScore: toPartialScoreColumn(questionScore.partialScore),
          status: questionScore.status,
        },
        include: {
          examStudent: { include: { student: true } },
          cropRegion: true,
          user: { omit: PUBLIC_USER_OMIT },
        },
      })

      await recordScoreAudit({
        action: "exam.score.update",
        scoreId: updated.id,
        student: updated.examStudent.student,
        cropRegion: updated.cropRegion,
        userId: questionScore.userId,
        changes: [
          {
            field: "status",
            label: "採点",
            before: scoreStatusLabel(existing.status),
            after: scoreStatusLabel(questionScore.status),
          },
          {
            field: "partialScore",
            label: "部分点",
            before:
              existing.partialScore != null
                ? Number(existing.partialScore)
                : null,
            after: questionScore.partialScore,
          },
        ],
      })

      return updated
    } else {
      // 新規作成。受け取った列はそのまま渡す（黙って落ちる列を作らない）
      const created = await prisma.questionScore.create({
        data: {
          ...questionScore,
          partialScore: toPartialScoreColumn(questionScore.partialScore),
        },
        include: {
          examStudent: { include: { student: true } },
          cropRegion: true,
          user: { omit: PUBLIC_USER_OMIT },
        },
      })

      await recordScoreAudit({
        action: "exam.score.propose",
        scoreId: created.id,
        student: created.examStudent.student,
        cropRegion: created.cropRegion,
        userId: questionScore.userId,
        changes: [
          {
            field: "status",
            label: "採点",
            before: null,
            after: scoreStatusLabel(questionScore.status),
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
 * 既にある採点行を、新しい採点結果で書き換える。
 *
 * **楽観的ロックはここには無い**（`version` 列はどのモデルにも無く、比較も一度も
 * 行われていなかった）。やっているのは「その行がまだ在るか」の確認だけで、それは
 * 差分記録用に変更前を取る `findUnique` が兼ねている。
 */
export const updateQuestionScore = async (
  id: string,
  result: QuestionScoreResult
) => {
  try {
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
        partialScore: toPartialScoreColumn(result.partialScore),
        status: result.status,
      },
      include: {
        examStudent: { include: { student: true } },
        cropRegion: true,
        user: { omit: PUBLIC_USER_OMIT },
      },
    })

    await recordScoreAudit({
      action: "exam.score.update",
      scoreId: updated.id,
      student: updated.examStudent.student,
      cropRegion: updated.cropRegion,
      userId: updated.userId,
      changes: [
        {
          field: "status",
          label: "採点",
          before: scoreStatusLabel(before.status),
          after: scoreStatusLabel(updated.status),
        },
        {
          field: "partialScore",
          label: "部分点",
          before:
            before.partialScore != null ? Number(before.partialScore) : null,
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

/**
 * 採点データをトランザクション内で一括upsertする（OMR自動採点結果の反映用）。
 *
 * 1件ずつの意味は `setQuestionScore` と同じ（無ければ作り、有れば上書きする）ので
 * 引数の形も同じものを使う。
 */
export async function batchUpdateQuestionScores(
  questionScores: SetQuestionScoreData[]
): Promise<{ updatedCount: number }> {
  try {
    let updatedCount = 0

    // 採点領域と受験者が同じ試験のものであること（FK は片方ずつしか見ない）
    await assertCropRegionsInSameExam(questionScores)

    // トランザクション内で一括処理
    await prisma.$transaction(async (tx) => {
      for (const questionScore of questionScores) {
        // 既存レコードを検索
        const existing = await tx.questionScore.findFirst({
          where: {
            examStudentId: questionScore.examStudentId,
            cropRegionId: questionScore.cropRegionId,
            userId: questionScore.userId,
          },
        })

        if (existing) {
          await tx.questionScore.update({
            where: { id: existing.id },
            data: {
              status: questionScore.status,
              partialScore: toPartialScoreColumn(questionScore.partialScore),
            },
          })
        } else {
          await tx.questionScore.create({
            data: {
              ...questionScore,
              partialScore: toPartialScoreColumn(questionScore.partialScore),
            },
          })
        }
        updatedCount++
      }
    })

    // 監査ログ: 一括反映（OMR自動採点等）。1件にまとめて記録する。
    if (questionScores.length > 0) {
      const scope = await resolveExamScopeByCropRegion(
        questionScores[0].cropRegionId
      )
      await recordAuditLog({
        action: "exam.score.batch",
        userId: questionScores[0].userId,
        entityType: "QuestionScore",
        entityId: questionScores[0].cropRegionId,
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
