/**
 * GradeDataSource（成績データソース）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"

import { toGradeDataSourceType } from "../../../src/types/grade.types"
import type { GradeDataSourceMaxScoreRef } from "../../../src/types/prismaExtensions"
import { recordAuditLog } from "./auditLog"
import { resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"
import { buildEstimationSourceId } from "./deterministicId"
import { serializePrisma } from "./serializePrisma"

/**
 * DataSource が参照するリレーションの include（単一 SSOT）。
 * 全生成元（grade / gradeItem / dataSource）でこれを使い、返り値の形状を一致させる。
 * coursework（coursework_total 型が参照する資料）まで含む完全版。
 */
export const gradeDataSourceInclude = {
  exam: {
    select: {
      id: true,
      examName: true,
      examDate: true,
      // maxScore(exam_total) を追加クエリ無しで算出するための元データ。
      examPages: {
        select: {
          cropRegions: {
            where: { type: "QUESTION_ANSWER" },
            select: { points: true },
          },
        },
      },
    },
  },
  subtotal: {
    select: {
      id: true,
      name: true,
      order: true,
      // maxScore(subtotal) を追加クエリ無しで算出するための元データ。
      cropSubtotals: {
        where: { assignmentType: "QUESTION_ASSIGNMENT" },
        select: {
          cropRegion: {
            select: { points: true, examPage: { select: { examId: true } } },
          },
        },
      },
    },
  },
  cropRegion: { select: { id: true, label: true, points: true } },
  courseworkItem: {
    include: {
      coursework: { select: { id: true, name: true } },
      letterScales: { orderBy: { order: "asc" } },
      _count: { select: { scores: true, gradeDataSources: true } },
    },
  },
  coursework: {
    select: {
      id: true,
      name: true,
      // maxScore(coursework_total) を追加クエリ無しで算出するための元データ。
      items: { select: { maxScore: true } },
    },
  },
  // estimationMode="selected" のとき推定に使う他データソース（旧 estimationSourceIds のJSON配列）
  estimationSources: { orderBy: { order: "asc" } },
} satisfies Prisma.GradeDataSourceInclude

/** GradeItem を dataSources 込みで取得する際の include（上記を内包）。 */
export const gradeItemWithDataSourcesInclude = {
  dataSources: {
    include: gradeDataSourceInclude,
    orderBy: { order: "asc" },
  },
} satisfies Prisma.GradeItemInclude

/**
 * 推定に使う他データソースの nested create 行を組み立てる。
 * 自分自身への参照は推定の材料になりえないため落とす。重複も畳む（`@@unique` 違反回避）。
 */
export function buildEstimationSourceRows(
  dataSourceId: string,
  sourceDataSourceIds: string[]
) {
  const unique = [...new Set(sourceDataSourceIds)].filter(
    (sourceDataSourceId) => sourceDataSourceId !== dataSourceId
  )
  return unique.map((sourceDataSourceId, index) => ({
    id: buildEstimationSourceId(dataSourceId, sourceDataSourceId),
    sourceDataSourceId,
    order: index,
  }))
}

/**
 * maxScore 算出に必要な元データ（gradeDataSourceInclude で同梱される）を型で表す。
 * 集計元まで payload に載っているため、算出は追加クエリ無し・完全同期で行える。
 */
type MaxScorePayloadSource = GradeDataSourceMaxScoreRef & {
  cropRegion?: { points: number | null } | null
  courseworkItem?: { maxScore: unknown } | null
  coursework?: { items: Array<{ maxScore: unknown }> } | null
  exam?: {
    examPages: Array<{ cropRegions: Array<{ points: number | null }> }>
  } | null
  subtotal?: {
    cropSubtotals: Array<{
      cropRegion: { points: number | null; examPage: { examId: string } }
    }>
  } | null
}

/**
 * enriched payload（gradeDataSourceInclude 同梱の元データ）から maxScore を同期算出する。
 * 満点は DB 列ではなく元データ（設問配点/評価項目満点）から毎回導くが、必要な元データは
 * 主クエリで既に取得済みのため、ここでは追加の DB アクセスを行わない。
 */
function computeMaxScoreFromPayload(dataSource: MaxScorePayloadSource): number {
  switch (dataSource.type) {
    case "crop_region":
      return dataSource.cropRegion?.points ?? 0
    case "coursework":
      return Number(dataSource.courseworkItem?.maxScore ?? 0)
    case "coursework_total":
      return (dataSource.coursework?.items ?? []).reduce(
        (sum, item) => sum + Number(item.maxScore),
        0
      )
    case "exam_total":
      return (dataSource.exam?.examPages ?? [])
        .flatMap((examPage) => examPage.cropRegions)
        .reduce((sum, cropRegion) => sum + (cropRegion.points ?? 0), 0)
    case "subtotal":
      return (dataSource.subtotal?.cropSubtotals ?? [])
        .filter(
          (cropSubtotal) =>
            cropSubtotal.cropRegion.examPage.examId === dataSource.examId
        )
        .reduce(
          (sum, cropSubtotal) => sum + (cropSubtotal.cropRegion.points ?? 0),
          0
        )
    default:
      return 0
  }
}

/** gradeDataSourceInclude で取得した DataSource（集計元同梱）の型。 */
type EnrichedGradeDataSource = Prisma.GradeDataSourceGetPayload<{
  include: typeof gradeDataSourceInclude
}>

/**
 * serialize 済み DataSource に、仮想フィールド maxScore を（同梱済み元データから）付与する。
 * レンダラへ返す全経路で必ず通す。
 *
 * 推定に使う他データソース（estimationSources）は中間テーブルの行をそのまま渡す。
 * 旧 estimationSourceIds（JSON配列）と違い FK で守られているため、参照先が消えれば
 * 行ごと消える。
 *
 * maxScore 算出専用に同梱した集計元（exam.examPages / subtotal.cropSubtotals /
 * coursework.items）は、算出後に落として renderer 返却形状（grade.types の Pick）へ一致させる
 * — untyped な集計元を IPC で送らないため。
 */
export function hydrateGradeDataSource(dataSource: EnrichedGradeDataSource) {
  const maxScore = computeMaxScoreFromPayload(dataSource)
  const { exam, subtotal, coursework, ...rest } = dataSource
  return {
    ...rest,
    type: toGradeDataSourceType(dataSource.type),
    maxScore,
    exam: exam && {
      id: exam.id,
      examName: exam.examName,
      examDate: exam.examDate,
    },
    subtotal: subtotal && {
      id: subtotal.id,
      name: subtotal.name,
      order: subtotal.order,
    },
    coursework: coursework && { id: coursework.id, name: coursework.name },
  }
}

type EnrichedGradeItem = { dataSources: EnrichedGradeDataSource[] }

/** GradeItem 1件の dataSources を全てハイドレートする。 */
export function hydrateGradeItem<GI extends EnrichedGradeItem>(gradeItem: GI) {
  return {
    ...gradeItem,
    dataSources: gradeItem.dataSources.map(hydrateGradeDataSource),
  }
}

/** GradeItem 配列を全てハイドレートする。 */
export function hydrateGradeItems<GI extends EnrichedGradeItem>(
  gradeItems: GI[]
) {
  return gradeItems.map(hydrateGradeItem)
}

/** Grade 全体（gradeItems[].dataSources[]）をハイドレートする。 */
export function hydrateGrade<G extends { gradeItems: EnrichedGradeItem[] }>(
  grade: G
) {
  return { ...grade, gradeItems: hydrateGradeItems(grade.gradeItems) }
}

/**
 * GradeItem配下のデータソース一覧を取得
 */
export async function getDataSourcesByGradeItemId(gradeItemId: string) {
  try {
    const dataSources = await prisma.gradeDataSource.findMany({
      where: { gradeItemId },
      include: gradeDataSourceInclude,
      orderBy: { order: "asc" },
    })
    return {
      success: true,
      dataSources: serializePrisma(dataSources).map(hydrateGradeDataSource),
    }
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
  type: string // "exam_total" | "subtotal" | "crop_region" | "coursework" | "coursework_total"
  examId?: string
  subtotalId?: string
  cropRegionId?: string
  courseworkItemId?: string
  courseworkId?: string
  name: string
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

    // estimationSources のidは自分のidから決定論的に作るため、先にidを確定させる
    const dataSourceId = randomUUID()

    const dataSource = await prisma.gradeDataSource.create({
      data: {
        id: dataSourceId,
        gradeItemId: data.gradeItemId,
        type: data.type,
        examId: data.examId,
        subtotalId: data.subtotalId,
        cropRegionId: data.cropRegionId,
        courseworkItemId: data.courseworkItemId,
        courseworkId: data.courseworkId,
        name: data.name,
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
          estimationSources: {
            create: buildEstimationSourceRows(
              dataSourceId,
              data.estimationSourceIds
            ),
          },
        }),
      },
      include: gradeDataSourceInclude,
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

    return {
      success: true,
      dataSource: hydrateGradeDataSource(serializePrisma(dataSource)),
    }
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
    const updateData: Prisma.GradeDataSourceUpdateInput = { ...rest }
    if (estimationSourceIds !== undefined) {
      // 選択の置き換え。決定論idなので、同じ組み合わせを選び直せば同じ行に戻る。
      updateData.estimationSources = {
        deleteMany: {},
        create: buildEstimationSourceRows(id, estimationSourceIds),
      }
    }
    const dataSource = await prisma.gradeDataSource.update({
      where: { id },
      data: updateData,
      include: gradeDataSourceInclude,
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

    return {
      success: true,
      dataSource: hydrateGradeDataSource(serializePrisma(dataSource)),
    }
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
    const examSubtotalGroups = await prisma.examSubtotalGroup.findMany({
      where: { examId },
      include: {
        subtotalGroup: {
          include: { subtotals: { orderBy: { order: "asc" } } },
        },
      },
    })
    return {
      success: true,
      subtotalGroups: examSubtotalGroups.map(
        (examSubtotalGroup) => examSubtotalGroup.subtotalGroup
      ),
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
    const cropRegions = pages.flatMap((page) => page.cropRegions)
    return { success: true, cropRegions: serializePrisma(cropRegions) }
  } catch (error) {
    console.error("Error getting exam crop regions:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * データソース1件の満点を元データ（設問配点 / 評価項目満点）からライブ算出する。
 *
 * GradeDataSource.maxScore 列はスナップショットに過ぎず、表示・計算では常にこの関数の
 * 算出値を使う（元データを後から変更しても追従させるため）。
 *
 * 入力は識別フィールド（種別・各ID）だけの場面（新規追加の見積り等）向け。集計元だけを
 * 個別クエリで取得し、**満点算出のルール自体は payload 版（`computeMaxScoreFromPayload`）に
 * 委譲する**（分岐ロジックの単一ソース化）。gradeDataSourceInclude 同梱の payload がある
 * 経路では `hydrateGradeDataSource` が同期算出するため、この関数は通らない。
 */
export async function computeLiveMaxScore(
  ds: GradeDataSourceMaxScoreRef
): Promise<number> {
  switch (ds.type) {
    case "crop_region": {
      const cropRegion = ds.cropRegionId
        ? await prisma.cropRegion.findUnique({
            where: { id: ds.cropRegionId },
            select: { points: true },
          })
        : null
      return computeMaxScoreFromPayload({ ...ds, cropRegion })
    }
    case "coursework": {
      const courseworkItem = ds.courseworkItemId
        ? await prisma.courseworkItem.findUnique({
            where: { id: ds.courseworkItemId },
            select: { maxScore: true },
          })
        : null
      return computeMaxScoreFromPayload({ ...ds, courseworkItem })
    }
    case "coursework_total": {
      const items = ds.courseworkId
        ? await prisma.courseworkItem.findMany({
            where: { courseworkId: ds.courseworkId },
            select: { maxScore: true },
          })
        : []
      return computeMaxScoreFromPayload({ ...ds, coursework: { items } })
    }
    case "exam_total": {
      const examPages = ds.examId
        ? await prisma.examPage.findMany({
            where: { examId: ds.examId },
            select: {
              cropRegions: {
                where: { type: "QUESTION_ANSWER" },
                select: { points: true },
              },
            },
          })
        : []
      return computeMaxScoreFromPayload({ ...ds, exam: { examPages } })
    }
    case "subtotal": {
      const cropSubtotals =
        ds.subtotalId && ds.examId
          ? await prisma.cropSubtotal.findMany({
              where: {
                subtotalId: ds.subtotalId,
                assignmentType: "QUESTION_ASSIGNMENT",
              },
              select: {
                cropRegion: {
                  select: {
                    points: true,
                    examPage: { select: { examId: true } },
                  },
                },
              },
            })
          : []
      return computeMaxScoreFromPayload({ ...ds, subtotal: { cropSubtotals } })
    }
    default:
      return 0
  }
}

/**
 * ソースタイプに応じて満点を自動計算（データソース追加UIの換算満点初期値用）
 */
export async function calculateSourceMaxScore(data: {
  type: string
  examId?: string
  subtotalId?: string
  cropRegionId?: string
  courseworkItemId?: string
  courseworkId?: string
}): Promise<{ success: boolean; maxScore?: number; error?: string }> {
  try {
    return { success: true, maxScore: await computeLiveMaxScore(data) }
  } catch (error) {
    console.error("Error calculating source max score:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
