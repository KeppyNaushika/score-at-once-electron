/**
 * ExamTag（試験-タグ関連）のPrisma操作関数
 */

import type { Exam, Tag } from "@prisma/client"

import { recordTagLinkAudit } from "./auditTagLinks"
import prisma from "./client"

/**
 * 試験のタグの付け外しを操作履歴へ残す。
 *
 * 概要のタグ欄は1つ付けるたびに書き、続けて付けられる（popover を開いたまま）ので、
 * **試験ごとに1行へまとめる**（`coalesceKey`）。変更内容は「最初のタグ → 最後のタグ」。
 */
async function recordExamTagAudit(
  exam: Exam,
  beforeTags: Tag[],
  afterTags: Tag[]
): Promise<void> {
  await recordTagLinkAudit({
    action: "exam.tag.update",
    entityType: "ExamTag",
    entityId: exam.id,
    scopeId: exam.id,
    scopeLabel: exam.examName,
    target: exam.examName,
    beforeTags,
    afterTags,
    coalesceKey: `exam_tags:${exam.id}`,
  })
}

/**
 * 試験-タグ関連を作成（一覧の一括タグ付けが1試験ずつ呼ぶ）
 */
export async function createExamTag(data: { examId: string; tagId: string }) {
  const examBefore = await prisma.exam.findUniqueOrThrow({
    where: { id: data.examId },
    include: { examTags: { include: { tag: true } } },
  })
  const created = await prisma.examTag.create({
    data,
    include: { tag: true },
  })

  const beforeTags = examBefore.examTags.map((examTag) => examTag.tag)
  await recordExamTagAudit(examBefore, beforeTags, [...beforeTags, created.tag])
  return created
}

/**
 * 試験のタグを一括設定（既存を全削除して再作成）
 */
export async function setExamTags(examId: string, tagIds: string[]) {
  const { examBefore, afterLinks } = await prisma.$transaction(async (tx) => {
    const exam = await tx.exam.findUniqueOrThrow({
      where: { id: examId },
      include: { examTags: { include: { tag: true } } },
    })
    await tx.examTag.deleteMany({ where: { examId } })
    if (tagIds.length === 0) return { examBefore: exam, afterLinks: [] }
    await tx.examTag.createMany({
      data: tagIds.map((tagId) => ({ examId, tagId })),
    })
    const links = await tx.examTag.findMany({
      where: { examId },
      include: { tag: true },
    })
    return { examBefore: exam, afterLinks: links }
  })

  await recordExamTagAudit(
    examBefore,
    examBefore.examTags.map((examTag) => examTag.tag),
    afterLinks.map((examTag) => examTag.tag)
  )
  return afterLinks
}
