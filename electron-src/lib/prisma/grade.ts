/**
 * Grade（成績算出試験）のPrisma操作関数
 *
 * ツリーごとの複製は `gradeDuplicate.ts` にある。
 */

import type { Prisma, Tag } from "@prisma/client"

import { diffFields, recordAuditLog } from "./auditLog"
import { recordTagLinkAudit } from "./auditTagLinks"
import prisma from "./client"
import {
  gradeItemWithDataSourcesInclude,
  hydrateGrade,
} from "./gradeDataSource"
import { serializePrisma } from "./serializePrisma"

/**
 * Grade を GradeWithRelations として返すときの include（SSOT）。
 *
 * 取得も作成も更新も同じ形を返す。以前は取得系だけが gradeStudents を同梱しており、
 * IPC の型は4経路とも GradeWithRelations を名乗っていたため、作成結果を一覧・詳細へ
 * そのまま渡すと `gradeStudents.length` が実行時に落ちた。
 */
const gradeWithRelationsInclude = {
  gradeClassrooms: {
    include: { classroom: true },
    orderBy: { order: "asc" },
  },
  gradeItems: {
    include: gradeItemWithDataSourcesInclude,
    orderBy: { order: "asc" },
  },
  // 対象者は行のまま渡し切る。件数は renderer が `.length` で取る
  // （件数も計算値なので main では作らない）
  gradeStudents: true,
  gradeTags: { include: { tag: true } },
} satisfies Prisma.GradeInclude

/**
 * 一覧が読む分だけの include（SSOT）。
 *
 * 一覧が使うのは「名前・学級・対象者数・評価項目数」と、次のステップ判定
 * （`gradeStatus`）が読む「境界の有無・データソースの有無」だけ。
 * 満点の元データ（exam.examPages / subtotal.cropSubtotals / coursework.items）も
 * 表示名用の参照先も、02/03/06 画面が使う `grade.getById` の側にだけあればよい。
 *
 * 列は削らない（規約: Prisma include の出力を射影せずそのまま持つ）。減らすのは
 * 「引くリレーション」であって列ではない。
 */
export const gradeSummaryInclude = {
  gradeClassrooms: {
    include: { classroom: true },
    orderBy: { order: "asc" },
  },
  gradeStudents: true,
  // 一覧はタグを表示し、タグでの絞り込みにも使う
  gradeTags: { include: { tag: true } },
  gradeItems: {
    include: {
      boundaries: { orderBy: { order: "asc" } },
      dataSources: { orderBy: { order: "asc" } },
    },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.GradeInclude

/**
 * 全成績算出試験を取得
 */
export async function getAllGrades() {
  const grades = await prisma.grade.findMany({
    include: gradeSummaryInclude,
    orderBy: { createdAt: "desc" },
  })
  // 一覧は満点を表示しないので hydrate（maxScore の付与）は通さない。
  // 元データを引いていないため、通しても 0 を並べるだけになる。
  return serializePrisma(grades)
}

/**
 * IDで成績算出試験を取得
 */
export async function getGradeById(id: string) {
  const grade = await prisma.grade.findUnique({
    where: { id },
    include: gradeWithRelationsInclude,
  })
  if (!grade) {
    throw new Error("Grade exam not found")
  }
  return hydrateGrade(serializePrisma(grade))
}

/**
 * 成績算出試験を作成
 */
export async function createGrade(data: {
  /** renderer が振った uuid。渡されなければ Prisma の既定（取り込み・テスト経路） */
  id?: string
  name: string
  description?: string
  referenceDate?: string | null
}) {
  const grade = await prisma.grade.create({
    data: {
      ...(data.id ? { id: data.id } : {}),
      name: data.name,
      description: data.description,
      referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
    },
    include: gradeWithRelationsInclude,
  })

  await recordAuditLog({
    action: "grade.create",
    entityType: "Grade",
    entityId: grade.id,
    scopeId: grade.id,
    scopeLabel: grade.name,
    target: grade.name,
  })

  return hydrateGrade(serializePrisma(grade))
}

/**
 * 成績算出試験を更新
 */
export async function updateGrade(
  id: string,
  data: {
    name?: string
    description?: string | null
    referenceDate?: string | null
  }
) {
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.referenceDate !== undefined) {
    updateData.referenceDate = data.referenceDate
      ? new Date(data.referenceDate)
      : null
  }
  const before = await prisma.grade.findUnique({
    where: { id },
  })
  const grade = await prisma.grade.update({
    where: { id },
    data: updateData,
    include: gradeWithRelationsInclude,
  })

  await recordAuditLog({
    action: "grade.update",
    entityType: "Grade",
    entityId: grade.id,
    scopeId: grade.id,
    scopeLabel: grade.name,
    target: grade.name,
    changes: diffFields(before ?? undefined, grade, [
      { field: "name", label: "成績名" },
      { field: "description", label: "説明" },
    ]),
  })

  return hydrateGrade(serializePrisma(grade))
}

/**
 * 成績算出試験を削除
 */
export async function deleteGrade(id: string) {
  const before = await prisma.grade.findUnique({
    where: { id },
  })
  await prisma.grade.delete({ where: { id } })

  await recordAuditLog({
    action: "grade.delete",
    entityType: "Grade",
    entityId: id,
    scopeId: id,
    scopeLabel: before?.name ?? null,
    target: before?.name ?? null,
  })
}

// =============================================================================
// タグ（GradeTag）
// =============================================================================

/** 付け替え前の姿（名前とタグ）。タグの付け外しの記録に使う */
const gradeWithTagsInclude = {
  gradeTags: { include: { tag: true } },
} satisfies Prisma.GradeInclude

/**
 * 成績算出のタグの付け外しを操作履歴へ残す。
 *
 * 概要のタグ欄は1つ付けるたびに書き、続けて付けられる（popover を開いたまま）ので、
 * **成績算出ごとに1行へまとめる**（`coalesceKey`）。変更内容は「最初のタグ → 最後のタグ」。
 */
async function recordGradeTagAudit(
  gradeBefore: Prisma.GradeGetPayload<{ include: typeof gradeWithTagsInclude }>,
  afterTags: Tag[]
): Promise<void> {
  await recordTagLinkAudit({
    action: "grade.tag.update",
    entityType: "GradeTag",
    entityId: gradeBefore.id,
    scopeId: gradeBefore.id,
    scopeLabel: gradeBefore.name,
    target: gradeBefore.name,
    beforeTags: gradeBefore.gradeTags.map((gradeTag) => gradeTag.tag),
    afterTags,
    coalesceKey: `grade_tags:${gradeBefore.id}`,
  })
}

/** 成績算出のタグを一括設定（既存を全削除して再作成） */
export async function setGradeTags(gradeId: string, tagIds: string[]) {
  const { gradeBefore, afterLinks } = await prisma.$transaction(async (tx) => {
    const grade = await tx.grade.findUniqueOrThrow({
      where: { id: gradeId },
      include: gradeWithTagsInclude,
    })
    await tx.gradeTag.deleteMany({ where: { gradeId } })
    if (tagIds.length > 0) {
      await tx.gradeTag.createMany({
        data: tagIds.map((tagId) => ({ gradeId, tagId })),
      })
    }
    const links = await tx.gradeTag.findMany({
      where: { gradeId },
      include: { tag: true },
    })
    return { gradeBefore: grade, afterLinks: links }
  })

  await recordGradeTagAudit(
    gradeBefore,
    afterLinks.map((gradeTag) => gradeTag.tag)
  )
}

/**
 * 成績算出にタグを1件追加（既存タグは保持・冪等）。
 *
 * 一覧の一括タグ付けはこちらを使う。全置換にすると、他端末が付けたタグを巻き添えにする。
 * 既に付いていたなら何も変わらないので記録しない。
 */
export async function addGradeTag(gradeId: string, tagId: string) {
  const gradeBefore = await prisma.grade.findUniqueOrThrow({
    where: { id: gradeId },
    include: gradeWithTagsInclude,
  })
  const link = await prisma.gradeTag.upsert({
    where: { gradeId_tagId: { gradeId, tagId } },
    update: {},
    create: { gradeId, tagId },
    include: { tag: true },
  })

  const beforeTags = gradeBefore.gradeTags.map((gradeTag) => gradeTag.tag)
  const afterTags = beforeTags.some((tag) => tag.id === link.tagId)
    ? beforeTags
    : [...beforeTags, link.tag]
  await recordGradeTagAudit(gradeBefore, afterTags)
}
