/**
 * GradeDataSource（成績データソース）のPrisma操作関数
 */

import { recordAuditLog } from "./auditLog"
import { resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"

/** Prisma Decimal等の非シリアライズ型をプレーン値に変換 */
function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/**
 * GradeItem配下のデータソース一覧を取得
 */
export async function getDataSourcesByGradeItemId(gradeItemId: string) {
  try {
    const dataSources = await prisma.gradeDataSource.findMany({
      where: { gradeItemId },
      include: {
        exam: { select: { id: true, examName: true, examDate: true } },
        subtotal: { select: { id: true, name: true, order: true } },
        cropRegion: { select: { id: true, label: true, points: true } },
        _count: { select: { manualScores: true } },
      },
      orderBy: { order: "asc" },
    })
    return { success: true, dataSources: serialize(dataSources) }
  } catch (error) {
    console.error("Error getting data sources:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * データソースを作成
 */
export async function createDataSource(data: {
  gradeItemId: string
  type: string // "exam_total" | "subtotal" | "crop_region" | "manual"
  examId?: string
  subtotalId?: string
  cropRegionId?: string
  name: string
  maxScore: number
  weight: number
  absentMethod?: string
  absentRatio?: number
  absentOffset?: number
  treatExpectedAsMissing?: boolean
  estimationMode?: string
  estimationSourceIds?: string[]
}) {
  try {
    // order を自動計算（gradeItem 内）
    const maxOrder = await prisma.gradeDataSource.aggregate({
      where: { gradeItemId: data.gradeItemId },
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const dataSource = await prisma.gradeDataSource.create({
      data: {
        gradeItemId: data.gradeItemId,
        type: data.type,
        examId: data.examId,
        subtotalId: data.subtotalId,
        cropRegionId: data.cropRegionId,
        name: data.name,
        maxScore: data.maxScore,
        weight: data.weight,
        order: nextOrder,
        ...(data.absentMethod !== undefined && {
          absentMethod: data.absentMethod,
        }),
        ...(data.absentRatio !== undefined && {
          absentRatio: data.absentRatio,
        }),
        ...(data.absentOffset !== undefined && {
          absentOffset: data.absentOffset,
        }),
        ...(data.treatExpectedAsMissing !== undefined && {
          treatExpectedAsMissing: data.treatExpectedAsMissing,
        }),
        ...(data.estimationMode !== undefined && {
          estimationMode: data.estimationMode,
        }),
        ...(data.estimationSourceIds !== undefined && {
          estimationSourceIds: JSON.stringify(data.estimationSourceIds),
        }),
      },
      include: {
        exam: { select: { id: true, examName: true, examDate: true } },
        subtotal: { select: { id: true, name: true, order: true } },
        cropRegion: { select: { id: true, label: true, points: true } },
      },
    })

    const scope = await resolveGradeScopeByItem(data.gradeItemId)
    await recordAuditLog({
      action: "grade.data_source.add",
      entityType: "GradeDataSource",
      entityId: dataSource.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: data.name,
    })

    return { success: true, dataSource: serialize(dataSource) }
  } catch (error) {
    console.error("Error creating data source:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * データソースを更新
 */
export async function updateDataSource(
  id: string,
  data: {
    name?: string
    maxScore?: number
    weight?: number
    absentMethod?: string
    absentRatio?: number
    absentOffset?: number
    treatExpectedAsMissing?: boolean
    estimationMode?: string
    estimationSourceIds?: string[]
  }
) {
  try {
    const { estimationSourceIds, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (estimationSourceIds !== undefined) {
      updateData.estimationSourceIds = JSON.stringify(estimationSourceIds)
    }
    const dataSource = await prisma.gradeDataSource.update({
      where: { id },
      data: updateData,
      include: {
        exam: { select: { id: true, examName: true, examDate: true } },
        subtotal: { select: { id: true, name: true, order: true } },
        cropRegion: { select: { id: true, label: true, points: true } },
      },
    })

    const scope = await resolveGradeScopeByItem(dataSource.gradeItemId)
    await recordAuditLog({
      action: "grade.data_source.update",
      entityType: "GradeDataSource",
      entityId: dataSource.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: dataSource.name,
    })

    return { success: true, dataSource: serialize(dataSource) }
  } catch (error) {
    console.error("Error updating data source:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * データソースを削除
 */
export async function deleteDataSource(id: string) {
  try {
    const before = await prisma.gradeDataSource.findUnique({
      where: { id },
      select: { name: true, gradeItemId: true },
    })

    await prisma.gradeDataSource.delete({ where: { id } })

    const scope = before
      ? await resolveGradeScopeByItem(before.gradeItemId)
      : null
    await recordAuditLog({
      action: "grade.data_source.remove",
      entityType: "GradeDataSource",
      entityId: id,
      scopeId: scope?.scopeId ?? null,
      scopeLabel: scope?.scopeLabel ?? null,
      target: before?.name ?? null,
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting data source:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * データソースの並び順を更新
 */
export async function reorderDataSources(
  items: { id: string; order: number }[]
) {
  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.gradeDataSource.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )
    return { success: true }
  } catch (error) {
    console.error("Error reordering data sources:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 複数DataSourceの欠席ポリシーを一括更新
 */
export async function batchUpdateAbsentPolicy(
  dataSourceIds: string[],
  policy: {
    absentMethod: string
    absentRatio: number
    absentOffset: number
    treatExpectedAsMissing?: boolean
    estimationMode?: string
    estimationSourceIds?: string[]
  }
) {
  try {
    const updateData: Record<string, unknown> = {
      absentMethod: policy.absentMethod,
      absentRatio: policy.absentRatio,
      absentOffset: policy.absentOffset,
    }
    if (policy.treatExpectedAsMissing !== undefined) {
      updateData.treatExpectedAsMissing = policy.treatExpectedAsMissing
    }
    if (policy.estimationMode !== undefined) {
      updateData.estimationMode = policy.estimationMode
    }
    if (policy.estimationSourceIds !== undefined) {
      updateData.estimationSourceIds = JSON.stringify(
        policy.estimationSourceIds
      )
    }
    await prisma.$transaction(
      dataSourceIds.map((id) =>
        prisma.gradeDataSource.update({
          where: { id },
          data: updateData,
        })
      )
    )
    return { success: true }
  } catch (error) {
    console.error("Error batch updating absent policy:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 全試験試験候補を取得（SubtotalGroupフィルタなし）
 */
export async function getExamCandidates() {
  try {
    const exams = await prisma.exam.findMany({
      select: {
        id: true,
        examName: true,
        examDate: true,
      },
      orderBy: { examDate: "desc" },
    })
    return { success: true, exams }
  } catch (error) {
    console.error("Error getting exam exam candidates:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 試験のSubtotalGroups取得（ExamSubtotalGroup経由）
 */
export async function getExamSubtotalGroups(examId: string) {
  try {
    const psg = await prisma.examSubtotalGroup.findMany({
      where: { examId },
      include: {
        subtotalGroup: {
          include: { subtotals: { orderBy: { order: "asc" } } },
        },
      },
    })
    return {
      success: true,
      subtotalGroups: psg.map((p) => p.subtotalGroup),
    }
  } catch (error) {
    console.error("Error getting exam subtotal groups:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 試験のQUESTION_ANSWER型CropRegion一覧を取得
 */
export async function getExamCropRegions(examId: string) {
  try {
    const pages = await prisma.examPage.findMany({
      where: { examId },
      include: {
        cropRegions: {
          where: { type: "QUESTION_ANSWER" },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { pageNumber: "asc" },
    })
    const cropRegions = pages.flatMap((p) => p.cropRegions)
    return { success: true, cropRegions: serialize(cropRegions) }
  } catch (error) {
    console.error("Error getting exam crop regions:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * ソースタイプに応じて満点を自動計算
 */
export async function calculateSourceMaxScore(data: {
  type: string
  examId?: string
  subtotalId?: string
  cropRegionId?: string
}): Promise<{ success: boolean; maxScore?: number; error?: string }> {
  try {
    if (data.type === "exam_total" && data.examId) {
      // 試験の全QUESTION_ANSWER CropRegionのpoints合計
      const pages = await prisma.examPage.findMany({
        where: { examId: data.examId },
        include: {
          cropRegions: { where: { type: "QUESTION_ANSWER" } },
        },
      })
      const total = pages
        .flatMap((p) => p.cropRegions)
        .reduce((sum, cr) => sum + (cr.points ?? 0), 0)
      return { success: true, maxScore: total }
    }

    if (data.type === "subtotal" && data.subtotalId && data.examId) {
      // Subtotalに紐づくCropRegion（QUESTION_ASSIGNMENT）のpoints合計
      const cropSubtotals = await prisma.cropSubtotal.findMany({
        where: {
          subtotalId: data.subtotalId,
          assignmentType: "QUESTION_ASSIGNMENT",
        },
        include: {
          cropRegion: {
            include: { examPage: { select: { examId: true } } },
          },
        },
      })
      const total = cropSubtotals
        .filter((cs) => cs.cropRegion.examPage.examId === data.examId)
        .reduce((sum, cs) => sum + (cs.cropRegion.points ?? 0), 0)
      return { success: true, maxScore: total }
    }

    if (data.type === "crop_region" && data.cropRegionId) {
      const cr = await prisma.cropRegion.findUnique({
        where: { id: data.cropRegionId },
        select: { points: true },
      })
      return { success: true, maxScore: cr?.points ?? 0 }
    }

    // manual → ユーザー入力なので0を返す
    return { success: true, maxScore: 0 }
  } catch (error) {
    console.error("Error calculating source max score:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
