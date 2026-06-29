import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import prisma from "./client"

/**
 * 小計点グループを全て取得
 */
export async function getSubtotalGroups() {
  try {
    const subtotalGroups = await prisma.subtotalGroup.findMany({
      include: {
        subtotals: {
          orderBy: { order: "asc" },
        },
        examSubtotalGroups: {
          include: {
            exam: {
              select: {
                id: true,
                examName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return {
      success: true,
      subtotalGroups,
    }
  } catch (error) {
    console.error("Error getting subtotal groups:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 小計点グループを作成
 */
export async function createSubtotalGroup(data: {
  name: string
  subtotals: {
    name: string
    order: number
  }[]
}) {
  try {
    const subtotalGroup = await prisma.subtotalGroup.create({
      data: {
        name: data.name,
        subtotals: {
          create: data.subtotals,
        },
      },
      include: {
        subtotals: {
          orderBy: { order: "asc" },
        },
      },
    })

    await recordAuditLog({
      action: "subtotal_group.create",
      entityType: "SubtotalGroup",
      entityId: subtotalGroup.id,
      target: subtotalGroup.name,
    })

    return {
      success: true,
      subtotalGroup,
    }
  } catch (error) {
    console.error("Error creating subtotal group:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 小計点グループを更新
 */
export async function updateSubtotalGroup(
  id: string,
  data: {
    name: string
    subtotals: {
      name: string
      order: number
    }[]
  }
) {
  try {
    // トランザクション内で更新
    const subtotalGroup = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 既存の小計項目を削除
        await tx.subtotal.deleteMany({
          where: { subtotalGroupId: id },
        })

        // 小計点グループを更新
        return await tx.subtotalGroup.update({
          where: { id },
          data: {
            name: data.name,
            subtotals: {
              create: data.subtotals,
            },
          },
          include: {
            subtotals: {
              orderBy: { order: "asc" },
            },
          },
        })
      }
    )

    await recordAuditLog({
      action: "subtotal_group.update",
      entityType: "SubtotalGroup",
      entityId: subtotalGroup.id,
      target: subtotalGroup.name,
    })

    return {
      success: true,
      subtotalGroup,
    }
  } catch (error) {
    console.error("Error updating subtotal group:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 小計点グループを削除
 */
export async function deleteSubtotalGroup(id: string) {
  try {
    // 実際にCropSubtotalで使用されているかを詳細にチェック
    const usageDetails = await prisma.cropSubtotal.findMany({
      where: {
        subtotal: {
          subtotalGroupId: id,
        },
      },
      include: {
        cropRegion: {
          include: {
            examPage: {
              include: {
                exam: {
                  select: {
                    id: true,
                    examName: true,
                  },
                },
              },
            },
          },
        },
        subtotal: {
          select: {
            name: true,
          },
        },
      },
    })

    // 実際に使用されている場合は削除を防ぐ
    if (usageDetails.length > 0) {
      // 試験別に使用状況をまとめる
      const usageByExam = usageDetails.reduce(
        (acc, usage) => {
          const examName = usage.cropRegion.examPage.exam.examName
          const subtotalName = usage.subtotal.name
          const cropRegionLabel =
            usage.cropRegion.label ||
            `設問${(usage.cropRegion.orderIndex || 0) + 1}`

          if (!acc[examName]) {
            acc[examName] = []
          }
          acc[examName].push(`${cropRegionLabel} → ${subtotalName}`)
          return acc
        },
        {} as Record<string, string[]>
      )

      const usageMessages = Object.entries(usageByExam)
        .map(
          ([examName, assignments]) =>
            `・${examName}: ${assignments.join(", ")}`
        )
        .join("\n")

      return {
        success: false,
        error: `この小計点グループは以下の設問で使用されており、削除できません:\n\n${usageMessages}\n\n設問との関連付けを先に解除してから削除してください。`,
      }
    }

    const before = await prisma.subtotalGroup.findUnique({
      where: { id },
      select: { name: true },
    })

    // 試験に追加されているが実際には使用されていない場合はExamSubtotalGroupも削除
    await prisma.$transaction(async (tx) => {
      // ExamSubtotalGroupを削除
      await tx.examSubtotalGroup.deleteMany({
        where: { subtotalGroupId: id },
      })

      // 小計点グループを削除（関連する小計項目も CASCADE で削除される）
      await tx.subtotalGroup.delete({
        where: { id },
      })
    })

    await recordAuditLog({
      action: "subtotal_group.delete",
      entityType: "SubtotalGroup",
      entityId: id,
      target: before?.name ?? null,
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error deleting subtotal group:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 試験で利用可能な小計点グループを取得（試験で有効化されていないもの）
 */
export async function getAvailableSubtotalGroupsForExam(examId: string) {
  try {
    const subtotalGroups = await prisma.subtotalGroup.findMany({
      where: {
        examSubtotalGroups: {
          none: {
            examId,
          },
        },
      },
      include: {
        subtotals: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { name: "asc" },
    })

    return {
      success: true,
      subtotalGroups,
    }
  } catch (error) {
    console.error("Error getting available subtotal groups for exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 試験で有効化されている小計点グループを取得
 */
export async function getActiveSubtotalGroupsForExam(examId: string) {
  try {
    const examSubtotalGroups = await prisma.examSubtotalGroup.findMany({
      where: {
        examId,
      },
      include: {
        subtotalGroup: {
          include: {
            subtotals: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: {
        subtotalGroup: {
          name: "asc",
        },
      },
    })

    return {
      success: true,
      examSubtotalGroups,
    }
  } catch (error) {
    console.error("Error getting active subtotal groups for exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 試験に小計点グループを追加
 */
export async function addSubtotalGroupToExam(
  examId: string,
  subtotalGroupId: string
) {
  try {
    const examSubtotalGroup = await prisma.examSubtotalGroup.create({
      data: {
        examId,
        subtotalGroupId,
      },
      include: {
        subtotalGroup: {
          include: {
            subtotals: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    })

    return {
      success: true,
      examSubtotalGroup,
    }
  } catch (error) {
    console.error("Error adding subtotal group to exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 試験から小計点グループを削除
 */
export async function removeSubtotalGroupFromExam(
  examId: string,
  subtotalGroupId: string
) {
  try {
    // この試験でCropSubtotalによって実際に使用されているかチェック
    const usageDetails = await prisma.cropSubtotal.findMany({
      where: {
        subtotal: {
          subtotalGroupId,
        },
        cropRegion: {
          examPage: {
            examId,
          },
        },
      },
      include: {
        cropRegion: {
          select: {
            label: true,
            orderIndex: true,
          },
        },
        subtotal: {
          select: {
            name: true,
          },
        },
      },
    })

    // 実際に使用されている場合は削除を防ぐ
    if (usageDetails.length > 0) {
      const assignments = usageDetails.map((usage) => {
        const cropRegionLabel =
          usage.cropRegion.label ||
          `設問${(usage.cropRegion.orderIndex || 0) + 1}`
        return `${cropRegionLabel} → ${usage.subtotal.name}`
      })

      return {
        success: false,
        error: `この小計点グループは以下の設問で使用されており、試験から削除できません:\n\n${assignments.join(", ")}\n\n設問との関連付けを先に解除してから削除してください。`,
      }
    }

    // 使用されていない場合は削除を実行
    await prisma.examSubtotalGroup.deleteMany({
      where: {
        examId,
        subtotalGroupId,
      },
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error removing subtotal group from exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 試験IDで有効な小計点グループ一覧を取得する（互換性レイヤー、examIdを付与して返す） */
export const getSubtotalGroupsByExamId = async (examId: string) => {
  const result = await getActiveSubtotalGroupsForExam(examId)
  if (result.success && result.examSubtotalGroups) {
    return result.examSubtotalGroups.map((psg) => ({
      ...psg.subtotalGroup,
      examId,
    }))
  }
  return []
}

/**
 * 小計グループの出力選択フラグを取得する（個人成績表のテーブル/箱ひげ図）。
 * source of truth は ExamSubtotalGroup.selectedForTable/selectedForBoxPlot（settingsJson ではない）。
 */
export async function getSubtotalGroupSelection(examId: string) {
  try {
    const links = await prisma.examSubtotalGroup.findMany({
      where: { examId },
      select: {
        subtotalGroupId: true,
        selectedForTable: true,
        selectedForBoxPlot: true,
      },
    })
    return {
      success: true as const,
      tableGroupIds: links
        .filter((l) => l.selectedForTable)
        .map((l) => l.subtotalGroupId),
      boxPlotGroupIds: links
        .filter((l) => l.selectedForBoxPlot)
        .map((l) => l.subtotalGroupId),
    }
  } catch (error) {
    console.error("Error getting subtotal group selection:", error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
      tableGroupIds: [],
      boxPlotGroupIds: [],
    }
  }
}

/**
 * 小計グループの出力選択フラグを設定する（個人成績表のテーブル/箱ひげ図）。
 * 指定 ID をフラグ true、それ以外を false にする（亡霊ID排除のため relational に保持）。
 *
 * @param tableGroupIds - 小計点テーブルに含める subtotalGroupId 群
 * @param boxPlotGroupIds - 箱ひげ図に含める subtotalGroupId 群
 */
export async function setSubtotalGroupSelection(
  examId: string,
  tableGroupIds: string[],
  boxPlotGroupIds: string[]
) {
  try {
    await prisma.$transaction(async (tx) => {
      // 一旦全フラグを false にし、指定IDのみ true へ。行ごとの update（N+1）を
      // 定数本数の updateMany に集約する。
      await tx.examSubtotalGroup.updateMany({
        where: { examId },
        data: { selectedForTable: false, selectedForBoxPlot: false },
      })
      if (tableGroupIds.length > 0) {
        await tx.examSubtotalGroup.updateMany({
          where: { examId, subtotalGroupId: { in: tableGroupIds } },
          data: { selectedForTable: true },
        })
      }
      if (boxPlotGroupIds.length > 0) {
        await tx.examSubtotalGroup.updateMany({
          where: { examId, subtotalGroupId: { in: boxPlotGroupIds } },
          data: { selectedForBoxPlot: true },
        })
      }
    })

    await recordAuditLog({
      action: "subtotal_group.selection_update",
      entityType: "ExamSubtotalGroup",
      entityId: examId,
    })

    return { success: true as const }
  } catch (error) {
    console.error("Error setting subtotal group selection:", error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** IDで小計点グループを取得する（subtotals・examSubtotalGroups含む） */
export const getSubtotalGroupById = async (id: string) => {
  return prisma.subtotalGroup.findUnique({
    where: { id },
    include: {
      subtotals: {
        orderBy: { order: "asc" },
      },
      examSubtotalGroups: {
        include: {
          exam: true,
        },
      },
    },
  })
}
