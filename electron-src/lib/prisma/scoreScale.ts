/**
 * 類型評価（類型の組。ScoreScale）と類型（ScoreScaleLevel）の読み書き
 * （docs/vlm-grading-design.md §4-8-3・§4-8-3a・§4-8-8）。
 *
 * 組は `examId` が null なら共通（どの試験でも選べる）、値があればその試験だけで選べる。
 * 03 の領域情報と類型評価管理の画面の、どちらからでも作る・直す・消すができる。
 *
 * **点はここで計算しない。** 点は採点行を読むときに、付けた類型の点数を引く（renderer）。
 * ここは行を返し、受け取った値を書くだけ。使われている件数も、画面は include した行の数で数える。
 *
 * **消すのは使われていないときだけ。** 画面は使われている組・類型の削除を出さないが、
 * 数え終わってから押すまでに同期で使う行が届くことがあるので、消す直前に main でも数え直して拒む。
 *
 * `score` は Decimal なので、返す経路は必ず serializePrisma を通す。
 */

import { Prisma } from "@prisma/client"

import { type AuditChange, diffFields, recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveExamScopeByCropRegion } from "./auditScope"
import { cropRegionAuditTarget } from "./auditTargets"
import prisma from "./client"
import { isRecordNotFoundError } from "./prismaErrors"
import { serializePrisma } from "./serializePrisma"

const levelOrder = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.ScoreScaleLevelOrderByWithRelationInput[]

const scaleOrder = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.ScoreScaleOrderByWithRelationInput[]

/**
 * 組を画面へ返すときの木。類型（並び順）と、使っている設問（試験付き）と、類型を使っている行を連れてくる。
 * 使われている件数は画面がこの行の数で数える（main で数えない）
 */
const scoreScaleInclude = {
  exam: true,
  levels: {
    orderBy: levelOrder,
    include: {
      questionScores: true,
      scoreDecisions: true,
      settingRubricItems: true,
    },
  },
  cropRegions: {
    include: { examPage: { include: { exam: true } } },
  },
} satisfies Prisma.ScoreScaleInclude

/**
 * 試験の設問が使っている組（類型を並び順で同梱）。出力の問題分析が、類型ごとの人数を
 * 付けられていない類型も 0 人として組の並び順で並べるために読む（docs/vlm-grading-design.md §4-8-5）
 */
export async function getScoreScalesForExam(examId: string) {
  const scoreScales = await prisma.scoreScale.findMany({
    where: { cropRegions: { some: { examPage: { examId } } } },
    include: { levels: { orderBy: levelOrder } },
    orderBy: scaleOrder,
  })
  return serializePrisma(scoreScales)
}

/**
 * 組の一覧。試験を渡せば、その試験で選べるもの（その試験のものと共通のもの）だけ。
 * 渡さなければ全部（類型評価管理の画面）
 */
export async function listScoreScales(filter: { examId: string | null }) {
  const scoreScales = await prisma.scoreScale.findMany({
    where:
      filter.examId === null
        ? undefined
        : { OR: [{ examId: filter.examId }, { examId: null }] },
    include: scoreScaleInclude,
    orderBy: scaleOrder,
  })
  return serializePrisma(scoreScales)
}

/** 点数を確かめる（0 以上の有限の数。配点を超えてよい） */
const toScore = (score: number): Prisma.Decimal => {
  if (!Number.isFinite(score) || score < 0) {
    throw new Error("点数は 0 以上の数にしてください")
  }
  return new Prisma.Decimal(score)
}

/** 組の監査ログの action と範囲。試験のものは試験の作業領域に入り、共通のものは入らない */
async function scaleAuditContext(examId: string | null): Promise<{
  prefix: string
  scopeId: string | null
  scopeLabel: string | null
}> {
  if (examId === null) {
    return { prefix: "score_scale", scopeId: null, scopeLabel: null }
  }
  const scope = await resolveExamScope(examId)
  return { prefix: "exam.score_scale", ...scope }
}

async function recordScaleAudit(input: {
  examId: string | null
  verb: string
  entityType: "ScoreScale" | "ScoreScaleLevel"
  entityId: string
  target: string
  actorUserId: string
  changes?: AuditChange[]
  coalesceKey?: string
}) {
  const context = await scaleAuditContext(input.examId)
  await recordAuditLog({
    action: `${context.prefix}.${input.verb}`,
    userId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    scopeId: context.scopeId,
    scopeLabel: context.scopeLabel,
    target: input.target,
    changes: input.changes,
    coalesceKey: input.coalesceKey,
  })
}

async function findScaleOrThrow(scoreScaleId: string) {
  const scoreScale = await prisma.scoreScale.findUnique({
    where: { id: scoreScaleId },
  })
  if (!scoreScale) throw new Error("類型評価が見つかりません")
  return scoreScale
}

/**
 * 組を作る。最初の類型（A/B/C とその点数など）は画面が決めて渡す（配点が分かる 03 と、分からない
 * 管理の画面で既定が違うため）。examId が null なら共通
 */
export async function createScoreScale(
  input: {
    examId: string | null
    name: string
    levels: { label: string; score: number }[]
  },
  actorUserId: string
) {
  const lastScale = await prisma.scoreScale.findFirst({
    where: { examId: input.examId },
    orderBy: { sortOrder: "desc" },
  })
  const created = await prisma.scoreScale.create({
    data: {
      examId: input.examId,
      name: input.name,
      sortOrder: (lastScale?.sortOrder ?? -1) + 1,
      levels: {
        create: input.levels.map((level, index) => ({
          label: level.label,
          score: toScore(level.score),
          sortOrder: index,
        })),
      },
    },
    include: scoreScaleInclude,
  })
  await recordScaleAudit({
    examId: input.examId,
    verb: "create",
    entityType: "ScoreScale",
    entityId: created.id,
    target: created.name,
    actorUserId,
  })
  return serializePrisma(created)
}

/** 組の名前を変える（1打鍵ごと） */
export async function updateScoreScale(
  scoreScaleId: string,
  data: { name: string },
  actorUserId: string
) {
  const before = await findScaleOrThrow(scoreScaleId)
  const updated = await prisma.scoreScale.update({
    where: { id: scoreScaleId },
    data: { name: data.name },
  })
  await recordScaleAudit({
    examId: updated.examId,
    verb: "update",
    entityType: "ScoreScale",
    entityId: scoreScaleId,
    target: updated.name,
    actorUserId,
    changes: diffFields(before, updated, [{ field: "name", label: "名前" }]),
    coalesceKey: `score_scale_name:${scoreScaleId}`,
  })
  return serializePrisma(updated)
}

/**
 * 共通にする（examId を null に）・試験に戻す（examId を試験に）。
 *
 * 試験に戻せるのは、その試験の設問だけが使っているときに限る。ほかの試験の設問が指したまま
 * 試験のものにすると、その試験では選べない組を指す設問が残る
 */
export async function setScoreScaleExam(
  scoreScaleId: string,
  examId: string | null,
  actorUserId: string
) {
  const before = await findScaleOrThrow(scoreScaleId)
  if (before.examId === examId) return serializePrisma(before)
  if (examId !== null) {
    const usedElsewhere = await prisma.cropRegion.findFirst({
      where: { scoreScaleId, examPage: { examId: { not: examId } } },
    })
    if (usedElsewhere) {
      throw new Error(
        "ほかの試験の設問が使っているので、この試験のものに戻せません"
      )
    }
  }
  const updated = await prisma.scoreScale.update({
    where: { id: scoreScaleId },
    data: { examId },
  })
  // 試験の作業領域から見えるよう、試験の側（戻す先・共通にする前の持ち主）で記録する
  await recordScaleAudit({
    examId: examId ?? before.examId,
    verb: "scope_update",
    entityType: "ScoreScale",
    entityId: scoreScaleId,
    target: updated.name,
    actorUserId,
    changes: [
      {
        field: "examId",
        label: "使える範囲",
        before: before.examId === null ? "共通" : "試験のみ",
        after: examId === null ? "共通" : "試験のみ",
      },
    ],
  })
  return serializePrisma(updated)
}

/**
 * 組を複製する（類型ごと）。`reassignCropRegionIds` の設問は複製を指すように付け替える
 * （「この試験用に複製して直す」。共通の組の点数を直すと使っているすべての試験の点が変わるため）
 */
export async function duplicateScoreScale(
  input: {
    scoreScaleId: string
    examId: string | null
    reassignCropRegionIds: string[]
  },
  actorUserId: string
) {
  const source = await prisma.scoreScale.findUnique({
    where: { id: input.scoreScaleId },
    include: { levels: { orderBy: levelOrder } },
  })
  if (!source) throw new Error("類型評価が見つかりません")
  if (input.examId !== null && input.reassignCropRegionIds.length > 0) {
    const outside = await prisma.cropRegion.findFirst({
      where: {
        id: { in: input.reassignCropRegionIds },
        examPage: { examId: { not: input.examId } },
      },
    })
    if (outside) throw new Error("ほかの試験の設問は付け替えられません")
  }
  const lastScale = await prisma.scoreScale.findFirst({
    where: { examId: input.examId },
    orderBy: { sortOrder: "desc" },
  })
  const created = await prisma.scoreScale.create({
    data: {
      examId: input.examId,
      name: `${source.name}（複製）`,
      sortOrder: (lastScale?.sortOrder ?? -1) + 1,
      levels: {
        create: source.levels.map((level) => ({
          label: level.label,
          description: level.description,
          score: level.score,
          sortOrder: level.sortOrder,
        })),
      },
    },
  })
  if (input.reassignCropRegionIds.length > 0) {
    await prisma.cropRegion.updateMany({
      where: {
        id: { in: input.reassignCropRegionIds },
        scoreScaleId: input.scoreScaleId,
      },
      data: { scoreScaleId: created.id },
    })
  }
  await recordScaleAudit({
    examId: input.examId,
    verb: "create",
    entityType: "ScoreScale",
    entityId: created.id,
    target: created.name,
    actorUserId,
  })
  const withTree = await prisma.scoreScale.findUniqueOrThrow({
    where: { id: created.id },
    include: scoreScaleInclude,
  })
  return serializePrisma(withTree)
}

/**
 * 組を消す。使っている設問があれば拒む（画面は使っている組の削除を出さないが、同期で届いた分を数え直す）。
 * 既に消えていれば何もしない
 */
export async function deleteScoreScale(
  scoreScaleId: string,
  actorUserId: string
) {
  const usedCount = await prisma.cropRegion.count({
    where: { scoreScaleId },
  })
  if (usedCount > 0) {
    throw new Error(
      `${usedCount}問の設問が使っているので、類型評価を消せません`
    )
  }
  const deleted = await prisma.scoreScale
    .delete({ where: { id: scoreScaleId } })
    .catch((error: unknown) => {
      if (isRecordNotFoundError(error)) return null
      throw error
    })
  if (!deleted) return
  await recordScaleAudit({
    examId: deleted.examId,
    verb: "delete",
    entityType: "ScoreScale",
    entityId: scoreScaleId,
    target: deleted.name,
    actorUserId,
  })
}

// ── 類型 ───────────────────────────────────────────────────

async function findLevelWithScaleOrThrow(scaleLevelId: string) {
  const level = await prisma.scoreScaleLevel.findUnique({
    where: { id: scaleLevelId },
    include: { scale: true },
  })
  if (!level) throw new Error("類型が見つかりません")
  return level
}

/** 類型を組の最後に足す */
export async function createScoreScaleLevel(
  input: { scaleId: string; label: string; description: string; score: number },
  actorUserId: string
) {
  const scoreScale = await findScaleOrThrow(input.scaleId)
  const lastLevel = await prisma.scoreScaleLevel.findFirst({
    where: { scaleId: input.scaleId },
    orderBy: { sortOrder: "desc" },
  })
  const created = await prisma.scoreScaleLevel.create({
    data: {
      scaleId: input.scaleId,
      label: input.label,
      description: input.description,
      score: toScore(input.score),
      sortOrder: (lastLevel?.sortOrder ?? -1) + 1,
    },
  })
  await recordScaleAudit({
    examId: scoreScale.examId,
    verb: "level.create",
    entityType: "ScoreScaleLevel",
    entityId: created.id,
    target: scoreScale.name,
    actorUserId,
  })
  return serializePrisma(created)
}

/** 類型の記号・説明・点数を変える（1打鍵ごと） */
export async function updateScoreScaleLevel(
  scaleLevelId: string,
  data: { label?: string; description?: string; score?: number },
  actorUserId: string
) {
  const before = await findLevelWithScaleOrThrow(scaleLevelId)
  const updated = await prisma.scoreScaleLevel.update({
    where: { id: scaleLevelId },
    data: {
      label: data.label,
      description: data.description,
      score: data.score === undefined ? undefined : toScore(data.score),
    },
  })
  await recordScaleAudit({
    examId: before.scale.examId,
    verb: "level.update",
    entityType: "ScoreScaleLevel",
    entityId: scaleLevelId,
    target: before.scale.name,
    actorUserId,
    changes: diffFields(
      { ...before, score: before.score.toString() },
      { ...updated, score: updated.score.toString() },
      [
        { field: "label", label: "記号" },
        { field: "description", label: "説明" },
        { field: "score", label: "点数" },
      ]
    ),
    coalesceKey: `score_scale_level:${scaleLevelId}`,
  })
  return serializePrisma(updated)
}

/**
 * 類型の並び順を入れ替える。並べ替えは N 行が全部か無しかなので、ここだけトランザクションで包む
 * （`docs/coding-style.md` の「日常の書き込みに `$transaction` を使わない」の例外。外部資料の換算表と同じ）
 */
export async function reorderScoreScaleLevels(
  scaleId: string,
  orders: { id: string; sortOrder: number }[],
  actorUserId: string
) {
  if (orders.length === 0) return
  const scoreScale = await findScaleOrThrow(scaleId)
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const order of orders) {
      await tx.scoreScaleLevel.update({
        where: { id: order.id, scaleId },
        data: { sortOrder: order.sortOrder },
      })
    }
  })
  await recordScaleAudit({
    examId: scoreScale.examId,
    verb: "level.reorder",
    entityType: "ScoreScale",
    entityId: scaleId,
    target: scoreScale.name,
    actorUserId,
    coalesceKey: `score_scale_level_reorder:${scaleId}`,
  })
}

/**
 * 類型を消す。付けた採点・確定・項目のどれかが使っていれば拒む。既に消えていれば何もしない
 */
export async function deleteScoreScaleLevel(
  scaleLevelId: string,
  actorUserId: string
) {
  const level = await prisma.scoreScaleLevel.findUnique({
    where: { id: scaleLevelId },
    include: {
      scale: true,
      _count: {
        select: {
          questionScores: true,
          scoreDecisions: true,
          settingRubricItems: true,
        },
      },
    },
  })
  if (!level) return
  const usedCount =
    level._count.questionScores +
    level._count.scoreDecisions +
    level._count.settingRubricItems
  if (usedCount > 0) {
    throw new Error(`類型「${level.label}」は使われているので消せません`)
  }
  const deleted = await prisma.scoreScaleLevel
    .delete({ where: { id: scaleLevelId } })
    .catch((error: unknown) => {
      if (isRecordNotFoundError(error)) return null
      throw error
    })
  if (!deleted) return
  await recordScaleAudit({
    examId: level.scale.examId,
    verb: "level.delete",
    entityType: "ScoreScaleLevel",
    entityId: scaleLevelId,
    target: level.scale.name,
    actorUserId,
  })
}

// ── 設問 ───────────────────────────────────────────────────

/**
 * 設問の類型評価で使う組を選ぶ（null で外す）。選べるのは共通の組と、その設問の試験の組だけ
 */
export async function setCropRegionScoreScale(
  cropRegionId: string,
  scoreScaleId: string | null,
  actorUserId: string
) {
  const before = await prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
    include: { examPage: true, scoreScale: true },
  })
  if (!before) throw new Error("採点領域が見つかりません")
  const nextScale =
    scoreScaleId === null ? null : await findScaleOrThrow(scoreScaleId)
  if (
    nextScale &&
    nextScale.examId !== null &&
    nextScale.examId !== before.examPage.examId
  ) {
    throw new Error("ほかの試験の類型評価は選べません")
  }
  const updated = await prisma.cropRegion.update({
    where: { id: cropRegionId },
    data: { scoreScaleId },
  })
  const scope = await resolveExamScopeByCropRegion(cropRegionId)
  await recordAuditLog({
    action: "exam.region.score_scale_update",
    userId: actorUserId,
    entityType: "CropRegion",
    entityId: cropRegionId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: updated.label || null,
    changes: [
      {
        field: "scoreScaleId",
        label: "類型評価",
        before: before.scoreScale?.name ?? null,
        after: nextScale?.name ?? null,
      },
    ],
    targets: [cropRegionAuditTarget(updated)],
  })
  return updated
}
