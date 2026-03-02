/**
 * GradeBoundarySet / GradeBoundary（成績境界）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"

import prisma from "./client"

/** Prisma Decimal等の非シリアライズ型をプレーン値に変換 */
function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/**
 * 成績算出試験の全境界セットを取得
 */
export async function getBoundarySetsByGradeId(gradeId: string) {
  try {
    const boundarySets = await prisma.gradeBoundarySet.findMany({
      where: { gradeId },
      include: {
        gradeItem: { select: { id: true, name: true, order: true } },
        boundaries: { orderBy: { order: "asc" } },
      },
      orderBy: [{ targetType: "asc" }, { gradeItem: { order: "asc" } }],
    })
    return { success: true, boundarySets: serialize(boundarySets) }
  } catch (error) {
    console.error("Error getting boundary sets:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 境界セットをupsert（セット＋境界を一括保存）
 */
export async function upsertBoundarySet(data: {
  gradeId: string
  targetType: string // "grade_item" | "overall"
  gradeItemId: string | null
  boundaries: { label: string; minPercentage: number; order: number }[]
}) {
  try {
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 既存セットを検索
        const existing = await tx.gradeBoundarySet.findFirst({
          where: {
            gradeId: data.gradeId,
            targetType: data.targetType,
            gradeItemId: data.gradeItemId,
          },
        })

        let setId: string
        if (existing) {
          setId = existing.id
          // 既存の境界を削除
          await tx.gradeBoundary.deleteMany({
            where: { gradeBoundarySetId: setId },
          })
        } else {
          const newSet = await tx.gradeBoundarySet.create({
            data: {
              gradeId: data.gradeId,
              targetType: data.targetType,
              gradeItemId: data.gradeItemId,
            },
          })
          setId = newSet.id
        }

        // 境界を作成
        if (data.boundaries.length > 0) {
          await tx.gradeBoundary.createMany({
            data: data.boundaries.map((b) => ({
              gradeBoundarySetId: setId,
              label: b.label,
              minPercentage: b.minPercentage,
              order: b.order,
            })),
          })
        }

        return tx.gradeBoundarySet.findUnique({
          where: { id: setId },
          include: {
            gradeItem: { select: { id: true, name: true, order: true } },
            boundaries: { orderBy: { order: "asc" } },
          },
        })
      }
    )
    return { success: true, boundarySet: serialize(result) }
  } catch (error) {
    console.error("Error upserting boundary set:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 境界セットを削除
 */
export async function deleteBoundarySet(id: string) {
  try {
    await prisma.gradeBoundarySet.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    console.error("Error deleting boundary set:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
