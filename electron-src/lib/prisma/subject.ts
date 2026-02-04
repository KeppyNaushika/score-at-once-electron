/**
 * Subject（教科）のPrisma操作関数
 */

import prisma from "./client"

/**
 * 全教科を取得
 */
export async function getAllSubjects() {
  return prisma.subject.findMany({
    orderBy: { name: "asc" },
  })
}

/**
 * IDで教科を取得
 */
export async function getSubjectById(id: string) {
  return prisma.subject.findUnique({
    where: { id },
  })
}

/**
 * SubtotalGroup IDリストに関連するSubjectを取得
 */
export async function getSubjectsBySubtotalGroupIds(
  subtotalGroupIds: string[]
) {
  return prisma.subject.findMany({
    where: {
      subjectSubtotalGroups: {
        some: {
          subtotalGroupId: { in: subtotalGroupIds },
        },
      },
    },
    include: {
      subjectSubtotalGroups: true,
    },
  })
}

/**
 * 教科を作成
 */
export async function createSubject(data: { name: string }) {
  return prisma.subject.create({
    data: { name: data.name },
  })
}

/**
 * 教科を更新
 */
export async function updateSubject(id: string, data: { name: string }) {
  return prisma.subject.update({
    where: { id },
    data: { name: data.name },
  })
}

/**
 * 教科を削除
 */
export async function deleteSubject(id: string) {
  return prisma.subject.delete({
    where: { id },
  })
}

/**
 * 名前で検索、なければ作成
 */
export async function findOrCreateSubject(name: string) {
  const existing = await prisma.subject.findUnique({
    where: { name },
  })
  if (existing) return existing

  return prisma.subject.create({
    data: { name },
  })
}
