/**
 * ルーブリック項目の助言から作る朱書きと、重なった助言の決まりの読み書き
 * （docs/vlm-grading-design.md §4-7・§5-2・§9）。
 *
 * - **重なった助言の決まり**（`RubricAdviceCombination`）: 助言のある項目が1枚の答案に2つ以上
 *   当たったときの朱書きの扱い（まとめた一文／1つの項目の助言だけ／並べる／なし）。設問ごとに
 *   採点者の間で共有する。組み合わせの同定は「項目の集合」の一致で行い、unique 制約にはしない
 *   （同期で同じ集合の行が2つできたら、保存のときに1つへまとめる）
 * - **助言の朱書き**: `isRubricAdvice` を立てた `DrawingAnnotation`。どの答案に何を作る・直す・
 *   消すかは renderer が求め（`planRubricAdviceSync`）、ここは受け取った差分を書くだけ。
 *   **印の付いた朱書きにしか触らない**（教員が手で書いた注釈は、id を渡されても書き換えない・消さない）
 */

import type { Prisma } from "@prisma/client"

import {
  type DrawingAnnotation,
  narrowAnnotationUnions,
} from "@/types/drawingAnnotation.types"
import { isRubricAdviceCombinationMode } from "@/types/rubric.types"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import { cropRegionAuditTarget } from "./auditTargets"
import prisma from "./client"
import { toSerializedQuestionScore } from "./questionScore"
import { serializePrisma } from "./serializePrisma"

/** 決まりを画面へ返すときの木（組み合わせを作る項目付き） */
const adviceCombinationInclude = {
  items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.RubricAdviceCombinationInclude

/** 設問の、重なった助言の決まりを全部（項目付き。古い順） */
export async function listRubricAdviceCombinations(cropRegionId: string) {
  return prisma.rubricAdviceCombination.findMany({
    where: { cropRegionId },
    include: adviceCombinationInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
}

/** 決まりの保存の引数。同じ項目の集合の決まりがあれば、それを書き換える */
export interface SaveRubricAdviceCombinationInput {
  cropRegionId: string
  /** 組み合わせを作る項目（2つ以上。並びは問わない） */
  rubricItemIds: string[]
  /** "merged" | "single" | "all" | "none"（境界の外から来るので文字列で受けて確かめる） */
  mode: string
  /** merged のときの一文 */
  mergedText: string
  /** single のときに採る項目 */
  primaryRubricItemId: string | null
}

/** 決まりの中身を確かめ、書く列の値にする。通らなければ投げる */
async function toCombinationColumns(input: SaveRubricAdviceCombinationInput) {
  const rubricItemIds = [...new Set(input.rubricItemIds)]
  if (rubricItemIds.length < 2) {
    throw new Error("重なった助言の決まりには、項目が2つ以上要ります")
  }
  if (!isRubricAdviceCombinationMode(input.mode)) {
    throw new Error(`朱書きの扱い「${input.mode}」は使えません`)
  }
  const rubricItems = await prisma.rubricItem.findMany({
    where: { id: { in: rubricItemIds }, cropRegionId: input.cropRegionId },
  })
  if (rubricItems.length !== rubricItemIds.length) {
    throw new Error("ルーブリック項目が、この設問のものではありません")
  }
  const mergedText = input.mode === "merged" ? input.mergedText.trim() : ""
  if (input.mode === "merged" && mergedText === "") {
    throw new Error("まとめた一文が空です")
  }
  const primaryRubricItemId =
    input.mode === "single" ? input.primaryRubricItemId : null
  if (
    input.mode === "single" &&
    (primaryRubricItemId === null ||
      !rubricItemIds.includes(primaryRubricItemId))
  ) {
    throw new Error("助言を採る項目が、組み合わせの中にありません")
  }
  return {
    rubricItemIds,
    rubricItems,
    columns: { mode: input.mode, mergedText, primaryRubricItemId },
  }
}

/** 2つの id の集合が同じか */
const isSameIdSet = (idsA: readonly string[], idsB: readonly string[]) =>
  new Set(idsA).size === new Set(idsB).size &&
  idsA.every((id) => idsB.includes(id))

/**
 * 重なった助言の決まりを保存する。同じ項目の集合の決まりが既にあれば（同期で2つ以上できて
 * いれば、いちばん新しいものを）書き換え、残りは消す。無ければ作る。保存した決まりを返す
 */
export async function saveRubricAdviceCombination(
  input: SaveRubricAdviceCombinationInput,
  actorUserId: string
) {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: input.cropRegionId },
  })
  if (!cropRegion) throw new Error("設問が見つかりません")
  const { rubricItemIds, rubricItems, columns } =
    await toCombinationColumns(input)

  const saved = await prisma.$transaction(async (tx) => {
    const existingCombinations = await tx.rubricAdviceCombination.findMany({
      where: { cropRegionId: input.cropRegionId },
      include: { items: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    })
    const sameSetCombinations = existingCombinations.filter((combination) =>
      isSameIdSet(
        combination.items.map((item) => item.rubricItemId),
        rubricItemIds
      )
    )
    const [kept, ...duplicates] = sameSetCombinations
    if (duplicates.length > 0) {
      await tx.rubricAdviceCombination.deleteMany({
        where: { id: { in: duplicates.map((combination) => combination.id) } },
      })
    }
    if (kept) {
      return tx.rubricAdviceCombination.update({
        where: { id: kept.id },
        data: columns,
        include: adviceCombinationInclude,
      })
    }
    return tx.rubricAdviceCombination.create({
      data: {
        cropRegionId: input.cropRegionId,
        ...columns,
        items: {
          create: rubricItemIds.map((rubricItemId) => ({ rubricItemId })),
        },
      },
      include: adviceCombinationInclude,
    })
  })

  const scope = await resolveExamScopeByCropRegion(input.cropRegionId)
  const itemLabels = rubricItems
    .map((rubricItem) => `「${rubricItem.label}」`)
    .join("＋")
  await recordAuditLog({
    action: "exam.rubric_advice.save",
    userId: actorUserId,
    entityType: "RubricAdviceCombination",
    entityId: saved.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: itemLabels,
    extra: { mode: saved.mode },
    targets: [cropRegionAuditTarget(cropRegion)],
  })

  return saved
}

/** 重なった助言の決まりを消す（その組み合わせは未決定に戻る）。消した行を返す */
export async function deleteRubricAdviceCombination(
  combinationId: string,
  actorUserId: string
) {
  const before = await prisma.rubricAdviceCombination.findUnique({
    where: { id: combinationId },
    include: { cropRegion: true },
  })
  if (!before) throw new Error("重なった助言の決まりが見つかりません")
  const deleted = await prisma.rubricAdviceCombination.delete({
    where: { id: combinationId },
  })

  const scope = await resolveExamScopeByCropRegion(before.cropRegionId)
  await recordAuditLog({
    action: "exam.rubric_advice.delete",
    userId: actorUserId,
    entityType: "RubricAdviceCombination",
    entityId: combinationId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    targets: [cropRegionAuditTarget(before.cropRegion)],
  })

  return deleted
}

/**
 * 助言の朱書きを作り直す材料。設問の項目・重なった助言の決まりと、**適用か助言の朱書きが
 * 1つ以上ある採点行の全部（どの採点者のものも）**を、適用と助言の朱書きを同梱して返す。
 * 何を作る・直す・消すかは renderer が求める。設問が無ければ null
 */
export async function getRubricAdviceSource(cropRegionId: string) {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
    include: {
      rubricItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
      rubricAdviceCombinations: {
        include: adviceCombinationInclude,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      questionScores: {
        where: {
          OR: [
            { rubricApplications: { some: {} } },
            { drawingAnnotations: { some: { isRubricAdvice: true } } },
          ],
        },
        include: {
          rubricApplications: true,
          drawingAnnotations: {
            where: { isRubricAdvice: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
        orderBy: { id: "asc" },
      },
    },
  })
  if (!cropRegion) return null
  return {
    ...serializePrisma(cropRegion),
    questionScores: cropRegion.questionScores.map((questionScore) => ({
      ...toSerializedQuestionScore(questionScore),
      drawingAnnotations: questionScore.drawingAnnotations.map(
        narrowAnnotationUnions
      ),
    })),
  }
}

/** 助言の朱書きの差分（renderer が `planRubricAdviceSync` で求めたもの） */
export interface RubricAdviceSyncInput {
  cropRegionId: string
  /** 作る朱書き（採点行に、まだ助言の朱書きが無いもの） */
  creates: { questionScoreId: string; annotation: DrawingAnnotation }[]
  /** 文を書き換える朱書き（位置と文字の大きさは変えない） */
  updates: { drawingAnnotationId: string; text: string }[]
  /** 消す朱書き */
  deletes: string[]
}

export interface RubricAdviceSyncResult {
  createdCount: number
  updatedCount: number
  deletedCount: number
}

/**
 * 助言の朱書きの差分を書く。**印（`isRubricAdvice`）の付いた朱書きにしか触らない。**
 *
 * - 作る: その設問の採点行で、まだ助言の朱書きが無い行にだけ作る（重ねて作らない）。
 *   印は必ず立てる
 * - 書き換える・消す: 印の付いた、その設問の朱書きだけ。手で書いた注釈の id が混じっても飛ばす
 *
 * 1回の書き込みを監査ログ1件にまとめる
 */
export async function syncRubricAdviceAnnotations(
  input: RubricAdviceSyncInput,
  actorUserId: string
): Promise<RubricAdviceSyncResult> {
  const result = await prisma.$transaction(async (tx) => {
    let createdCount = 0
    for (const create of input.creates) {
      const questionScore = await tx.questionScore.findUnique({
        where: { id: create.questionScoreId },
        include: { drawingAnnotations: { where: { isRubricAdvice: true } } },
      })
      if (
        !questionScore ||
        questionScore.cropRegionId !== input.cropRegionId ||
        questionScore.drawingAnnotations.length > 0
      ) {
        continue
      }
      await tx.drawingAnnotation.create({
        data: {
          ...create.annotation,
          isRubricAdvice: true,
          questionScoreId: questionScore.id,
        },
      })
      createdCount += 1
    }

    let updatedCount = 0
    for (const update of input.updates) {
      const updated = await tx.drawingAnnotation.updateMany({
        where: {
          id: update.drawingAnnotationId,
          isRubricAdvice: true,
          questionScore: { cropRegionId: input.cropRegionId },
        },
        data: { text: update.text, updatedAt: new Date() },
      })
      updatedCount += updated.count
    }

    const deleted =
      input.deletes.length === 0
        ? { count: 0 }
        : await tx.drawingAnnotation.deleteMany({
            where: {
              id: { in: input.deletes },
              isRubricAdvice: true,
              questionScore: { cropRegionId: input.cropRegionId },
            },
          })
    return { createdCount, updatedCount, deletedCount: deleted.count }
  })

  if (result.createdCount + result.updatedCount + result.deletedCount > 0) {
    const cropRegion = await prisma.cropRegion.findUnique({
      where: { id: input.cropRegionId },
    })
    const scope = await resolveExamScopeByCropRegion(input.cropRegionId)
    await recordAuditLog({
      action: "exam.rubric_advice.sync",
      userId: actorUserId,
      entityType: "CropRegion",
      entityId: input.cropRegionId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `ルーブリック項目の助言から朱書きを作りました（作成${result.createdCount}件・書き換え${result.updatedCount}件・削除${result.deletedCount}件）`,
      extra: { ...result },
      targets: cropRegion ? [cropRegionAuditTarget(cropRegion)] : [],
    })
  }

  return result
}
