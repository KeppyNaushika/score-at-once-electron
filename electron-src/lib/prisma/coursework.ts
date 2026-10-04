/**
 * Coursework（試験外成績資料）の Prisma 操作関数
 *
 * Coursework は Exam / SubtotalGroup と同階層のトップレベル実体。
 * 評価項目（CourseworkItem）が満点・点数・変換表を保持し、成績算出（GradeDataSource）からは
 * courseworkItemId で項目単位に参照される（点数そのものを共有・再利用）。
 *
 * ここは資料そのもの（取得・作成・更新・削除）とタグ、成績算出からの参照候補を持つ。
 * 評価項目は `courseworkItem.ts`、点数は `courseworkScore.ts`、名簿は `courseworkRoster.ts`、
 * 文字評価の刻みは `courseworkLetterScale.ts` にある。
 */

import type { Prisma } from "@prisma/client"

import {
  buildDeletionBlockedMessage,
  courseworkUsingDataSources,
} from "../../../src/lib/shared/gradeReferenceMessages"
import type { InputMode } from "../../../src/types/coursework.types"
import { recordAuditLog } from "./auditLog"
import prisma from "./client"
import { withInputMode } from "./courseworkItem"
import {
  courseworkGradeUsageInclude,
  gradeDataSourceUsageInclude,
} from "./gradeDataSourceUsage"
import { serializePrisma } from "./serializePrisma"

/** 資料の同梱評価項目にも同じ変換を掛ける */
const withCourseworkItems = <
  Coursework extends { items: { inputMode: string }[] },
>(
  coursework: Coursework
): Omit<Coursework, "items"> & {
  items: (Omit<Coursework["items"][number], "inputMode"> & {
    inputMode: InputMode
  })[]
} => ({
  ...coursework,
  items: coursework.items.map(withInputMode),
})

// =============================================================================
// Coursework（トップレベル）
// =============================================================================

/**
 * Coursework を CourseworkWithRelations として返すときの include（SSOT）。
 * 取得も作成も更新も同じ形を返す（作成結果をそのまま詳細画面へ渡せるようにするため）。
 */
const courseworkWithRelationsInclude = {
  classrooms: {
    include: { classroom: true },
    orderBy: { order: "asc" },
  },
  tags: { include: { tag: true } },
  items: {
    include: {
      letterScales: { orderBy: { order: "asc" } },
      gradeDataSources: { include: gradeDataSourceUsageInclude },
    },
    orderBy: { order: "asc" },
  },
  // 名簿は行のまま渡し切る。件数は renderer が `.length` で取る
  students: true,
  // この資料を使っている成績算出のデータソース（資料合計と、評価項目1つずつ）。
  // 資料の画面（layout）のロックと、削除の確認がここから導く
  gradeDataSources: { include: gradeDataSourceUsageInclude },
} satisfies Prisma.CourseworkInclude

/** 試験外成績資料の一覧（サマリ）を取得 */
export async function getCourseworks() {
  const courseworks = await prisma.coursework.findMany({
    include: {
      // 評価項目・名簿は行のまま渡し切る。件数は renderer が `.length` で取る
      items: { orderBy: { order: "asc" } },
      students: true,
      tags: {
        include: { tag: true },
      },
      classrooms: {
        include: { classroom: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
  })
  return serializePrisma(courseworks).map(withCourseworkItems)
}

/** 試験外成績資料を1件取得（詳細） */
export async function getCourseworkById(id: string) {
  const coursework = await prisma.coursework.findUnique({
    where: { id },
    include: courseworkWithRelationsInclude,
  })
  if (!coursework) {
    throw new Error("Coursework not found")
  }
  return withCourseworkItems(serializePrisma(coursework))
}

/** 試験外成績資料を作成 */
export async function createCoursework(data: {
  /** renderer が振った uuid。渡されなければ Prisma の既定（取り込み・テスト経路） */
  id?: string
  name: string
  description?: string | null
  referenceDate?: string | null
}) {
  const coursework = await prisma.coursework.create({
    data: {
      ...(data.id ? { id: data.id } : {}),
      name: data.name,
      description: data.description ?? null,
      referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
    },
    include: courseworkWithRelationsInclude,
  })

  await recordAuditLog({
    action: "coursework.create",
    entityType: "Coursework",
    entityId: coursework.id,
    scopeId: coursework.id,
    scopeLabel: coursework.name,
    target: coursework.name,
  })

  return withCourseworkItems(serializePrisma(coursework))
}

/** 試験外成績資料を更新（基本設定） */
export async function updateCoursework(
  id: string,
  data: {
    name?: string
    description?: string | null
    referenceDate?: string | null
  }
) {
  const updateData: {
    name?: string
    description?: string | null
    referenceDate?: Date | null
  } = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.referenceDate !== undefined)
    updateData.referenceDate = data.referenceDate
      ? new Date(data.referenceDate)
      : null

  const coursework = await prisma.coursework.update({
    where: { id },
    data: updateData,
    include: courseworkWithRelationsInclude,
  })

  await recordAuditLog({
    action: "coursework.update",
    entityType: "Coursework",
    entityId: coursework.id,
    scopeId: coursework.id,
    scopeLabel: coursework.name,
    target: coursework.name,
  })

  return withCourseworkItems(serializePrisma(coursework))
}

/**
 * 試験外成績資料を削除。
 * 成績算出（GradeDataSource）から評価項目または資料合計として使われている場合は
 * 消さずに断る（試験・小計点グループと同じく例外で。確認画面も同じ判定で前もって
 * 見せて押させない）。
 */
export async function deleteCoursework(id: string): Promise<void> {
  // 評価項目を1つずつ使う（courseworkItemId）ものと、資料全体を「資料合計」として
  // 使う（courseworkId）ものの両方を見る。後者を見落とすと削除が通り、参照は
  // `onDelete: SetNull` で黙って空になって、成績算出に名前だけのデータソースが残る
  const before = await prisma.coursework.findUnique({
    where: { id },
    include: courseworkGradeUsageInclude,
  })
  const blockedMessage = before
    ? buildDeletionBlockedMessage(
        "coursework",
        courseworkUsingDataSources(before)
      )
    : null
  if (blockedMessage !== null) throw new Error(blockedMessage)

  await prisma.coursework.delete({ where: { id } })

  await recordAuditLog({
    action: "coursework.delete",
    entityType: "Coursework",
    entityId: id,
    scopeId: id,
    scopeLabel: before?.name ?? null,
    target: before?.name ?? null,
  })
}

// =============================================================================
// タグ（CourseworkTag）
// =============================================================================

/** 資料のタグを一括設定（既存を全削除して再作成） */
export async function setCourseworkTags(
  courseworkId: string,
  tagIds: string[]
) {
  await prisma.$transaction(async (tx) => {
    await tx.courseworkTag.deleteMany({ where: { courseworkId } })
    if (tagIds.length > 0) {
      await tx.courseworkTag.createMany({
        data: tagIds.map((tagId) => ({ courseworkId, tagId })),
      })
    }
  })
}

/** 資料にタグを1件追加（既存タグは保持・冪等）。一括付与での既存タグ消失を避ける */
export async function addCourseworkTag(courseworkId: string, tagId: string) {
  await prisma.courseworkTag.upsert({
    where: { courseworkId_tagId: { courseworkId, tagId } },
    update: {},
    create: { courseworkId, tagId },
  })
}

// =============================================================================
// 成績算出からの参照用（資料→評価項目の候補）
// =============================================================================

/** 成績データソースの参照候補として、資料と評価項目の一覧を取得 */
export async function getCourseworkCandidates() {
  const courseworks = await prisma.coursework.findMany({
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
  })
  return serializePrisma(courseworks).map(withCourseworkItems)
}
