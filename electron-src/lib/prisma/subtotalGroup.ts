import prisma from "./client"
import type { Prisma } from "@prisma/client"

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
        projectSubtotalGroups: {
          include: {
            project: {
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
    const subtotalGroup = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
            projectPage: {
              include: {
                project: {
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
      // プロジェクト別に使用状況をまとめる
      const usageByProject = usageDetails.reduce((acc, usage) => {
        const projectName = usage.cropRegion.projectPage.project.examName
        const subtotalName = usage.subtotal.name
        const cropRegionLabel = usage.cropRegion.label || `設問${(usage.cropRegion.orderIndex || 0) + 1}`
        
        if (!acc[projectName]) {
          acc[projectName] = []
        }
        acc[projectName].push(`${cropRegionLabel} → ${subtotalName}`)
        return acc
      }, {} as Record<string, string[]>)

      const usageMessages = Object.entries(usageByProject)
        .map(([projectName, assignments]) => 
          `・${projectName}: ${assignments.join(", ")}`
        )
        .join("\n")

      return {
        success: false,
        error: `この小計点グループは以下の設問で使用されており、削除できません:\n\n${usageMessages}\n\n設問との関連付けを先に解除してから削除してください。`,
      }
    }

    // プロジェクトに追加されているが実際には使用されていない場合はProjectSubtotalGroupも削除
    await prisma.$transaction(async (tx) => {
      // ProjectSubtotalGroupを削除
      await tx.projectSubtotalGroup.deleteMany({
        where: { subtotalGroupId: id },
      })

      // 小計点グループを削除（関連する小計項目も CASCADE で削除される）
      await tx.subtotalGroup.delete({
        where: { id },
      })
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
 * プロジェクトで利用可能な小計点グループを取得（プロジェクトで有効化されていないもの）
 */
export async function getAvailableSubtotalGroupsForProject(projectId: string) {
  try {
    const subtotalGroups = await prisma.subtotalGroup.findMany({
      where: {
        projectSubtotalGroups: {
          none: {
            projectId,
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
    console.error("Error getting available subtotal groups for project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * プロジェクトで有効化されている小計点グループを取得
 */
export async function getActiveSubtotalGroupsForProject(projectId: string) {
  try {
    const projectSubtotalGroups = await prisma.projectSubtotalGroup.findMany({
      where: {
        projectId,
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
      projectSubtotalGroups,
    }
  } catch (error) {
    console.error("Error getting active subtotal groups for project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * プロジェクトに小計点グループを追加
 */
export async function addSubtotalGroupToProject(
  projectId: string,
  subtotalGroupId: string
) {
  try {
    const projectSubtotalGroup = await prisma.projectSubtotalGroup.create({
      data: {
        projectId,
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
      projectSubtotalGroup,
    }
  } catch (error) {
    console.error("Error adding subtotal group to project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * プロジェクトから小計点グループを削除
 */
export async function removeSubtotalGroupFromProject(
  projectId: string,
  subtotalGroupId: string
) {
  try {
    // このプロジェクトでCropSubtotalによって実際に使用されているかチェック
    const usageDetails = await prisma.cropSubtotal.findMany({
      where: {
        subtotal: {
          subtotalGroupId,
        },
        cropRegion: {
          projectPage: {
            projectId,
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
      const assignments = usageDetails.map(usage => {
        const cropRegionLabel = usage.cropRegion.label || `設問${(usage.cropRegion.orderIndex || 0) + 1}`
        return `${cropRegionLabel} → ${usage.subtotal.name}`
      })

      return {
        success: false,
        error: `この小計点グループは以下の設問で使用されており、プロジェクトから削除できません:\n\n${assignments.join(", ")}\n\n設問との関連付けを先に解除してから削除してください。`,
      }
    }

    // 使用されていない場合は削除を実行
    await prisma.projectSubtotalGroup.deleteMany({
      where: {
        projectId,
        subtotalGroupId,
      },
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error removing subtotal group from project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// 既存の関数は互換性のために残す
export const getSubtotalGroupsByProjectId = async (projectId: string) => {
  const result = await getActiveSubtotalGroupsForProject(projectId)
  if (result.success && result.projectSubtotalGroups) {
    return result.projectSubtotalGroups.map((psg) => ({
      ...psg.subtotalGroup,
      projectId,
    }))
  }
  return []
}

export const getSubtotalGroupById = async (id: string) => {
  return prisma.subtotalGroup.findUnique({
    where: { id },
    include: {
      subtotals: {
        orderBy: { order: "asc" },
      },
      projectSubtotalGroups: {
        include: {
          project: true,
        },
      },
    },
  })
}
