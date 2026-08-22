import type { Prisma, QuestionScore } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/client"

import type { Serialized } from "@/types/prismaExtensions"
import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

import { type AuditChange, recordAuditLog } from "./auditLog"
import {
  resolveExamScopeByCropRegion,
  resolveExamStudentLabel,
} from "./auditScope"
import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"
import { isRecordNotFoundError } from "./prismaErrors"
import { serializePrisma } from "./serializePrisma"

/**
 * 採点行を「シリアライズ後の形」へ倒す境界コンバータ。
 *
 * `partialScore`（Decimal）を number へ、`status`（DB 上は String 列）を
 * `ScoringStatus` へ絞る。**この2点の補正を行うのはここ1箇所**で、
 * 型の側の相棒は `SerializedQuestionScore`（types/prismaExtensions.ts）。
 * 同梱したリレーションは落とさずそのまま持つ（射影しない）。
 */
export const toSerializedQuestionScore = <
  Row extends Omit<QuestionScore, "status"> & { status: string },
>(
  questionScore: Row
): Serialized<Row> & { status: ScoringStatus } => ({
  ...serializePrisma(questionScore),
  status: toScoringStatus(questionScore.status),
})

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

/**
 * 試験の採点データを取得
 *
 * 行を作るのはこの関数なので、Decimal→number と判定の絞り込みもここで済ませる
 * （`toSerializedQuestionScore`）。呼ぶ側（出力・PDF・返却差分・確定リゾルバ）は
 * `SerializedQuestionScore` として受け取れる。
 *
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

    return scores.map(toSerializedQuestionScore)
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
          user: true,
        },
      })

      await recordScoreAudit({
        action: "exam.score.update",
        scoreId: updated.id,
        cropRegionId: questionScore.cropRegionId,
        examStudentId: questionScore.examStudentId,
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
          user: true,
        },
      })

      await recordScoreAudit({
        action: "exam.score.propose",
        scoreId: created.id,
        cropRegionId: questionScore.cropRegionId,
        examStudentId: questionScore.examStudentId,
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
 * `setQuestionScoreComment` の引数。行の同定（受験者×設問×採点者）＋ 覚え書き。
 *
 * 判定・部分点は持たない。**覚え書きは採点とは別の操作**で、同じ口で受けると
 * 「覚え書きだけ直したいのに判定も送らされる」形になり、送らなかった側が
 * 黙って初期値へ戻る。
 */
export interface SetQuestionScoreCommentData extends EnsureQuestionScoreData {
  /** その点にした理由。空文字は「書いていない」と同じ（列は NULL を持たない） */
  comment: string
}

/**
 * その採点者が、その点にした理由の覚え書きを書く。
 *
 * **かつて `UpdateQuestionScoreData` に `comment?: string` という項目があったが、
 * `QuestionScore` に列が無く、渡しても何も起きなかった**（段階34 で撤去済み）。
 * 今度は列が実在し（`comment String @default("")`）、ここが唯一の書き込み口である。
 *
 * 採点行が無ければ用意する（`ensureQuestionScore`）。手書き注釈と同じ形で、
 * 「まだ採点していないマスに覚え書きだけ書く」を通すため。
 *
 * **ただし空の覚え書きで行は作らない。** 覚え書き欄を開いて何も書かずに離れた
 * だけで `status:"unscored"` の空行が増えると、設問をめくるだけで行が量産されて
 * いた頃（docs/branch-review-findings.md #2）に戻る。書いていない覚え書きは
 * 行の不在でそのまま表せる。
 *
 * @returns 書いた行。何も書かなかったとき（行が無く、覚え書きも空）は null
 */
export const setQuestionScoreComment = async (
  data: SetQuestionScoreCommentData
) => {
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

  if (!existing && data.comment === "") return null
  if (existing && existing.comment === data.comment) return existing

  const target =
    existing ??
    (await ensureQuestionScore({
      examStudentId: data.examStudentId,
      cropRegionId: data.cropRegionId,
      userId: data.userId,
    }))

  const updated = await prisma.questionScore.update({
    where: { id: target.id },
    data: { comment: data.comment },
    include,
  })

  const scope = await resolveExamScopeByCropRegion(data.cropRegionId)
  const studentLabel = await resolveExamStudentLabel(data.examStudentId)
  await recordAuditLog({
    action: "exam.score.comment",
    userId: data.userId,
    entityType: "QuestionScore",
    entityId: updated.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: studentLabel
      ? `「${studentLabel}」の採点に覚え書きを残しました`
      : "採点に覚え書きを残しました",
    changes: [
      {
        field: "comment",
        label: "覚え書き",
        before: existing?.comment ?? "",
        after: data.comment,
      },
    ],
  })

  return updated
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
