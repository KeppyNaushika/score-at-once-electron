/**
 * GradeDataSource（成績データソース）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"
import * as crypto from "crypto"

import { toGradeDataSourceType } from "../../../src/types/grade.types"
import type { Serialized } from "../../../src/types/prismaExtensions"
import { computeMaxScoreFromPayload } from "../shared/calculations/gradeDataSourceMaxScore"
import { recordAuditLog } from "./auditLog"
import { resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"
import { subtotalWithQuestionAssignmentsInclude } from "./cropSubtotal"
import { serializePrisma } from "./serializePrisma"

/**
 * DataSource が参照するリレーションの include（単一 SSOT）。
 * 全生成元（grade / gradeItem / dataSource）でこれを使い、返り値の形状を一致させる。
 * coursework（coursework_total 型が参照する資料）まで含む完全版。
 */
export const gradeDataSourceInclude = {
  exam: {
    include: {
      // maxScore(exam_total) を追加クエリ無しで算出するための元データ。
      examPages: {
        include: { cropRegions: { where: { type: "QUESTION_ANSWER" } } },
      },
    },
  },
  // maxScore(subtotal) と設問割り当ての元データ。
  // 領域種別まで条件に書くのは、renderer 側（getExamCropRegions 経由）が
  // QUESTION_ANSWER の領域だけを見て同じ満点を出すため。同じ条件を両側で明示する。
  subtotal: { include: subtotalWithQuestionAssignmentsInclude },
  cropRegion: true,
  courseworkItem: {
    include: {
      coursework: true,
      letterScales: { orderBy: { order: "asc" } },
      // 点数は行のまま渡し切る。「入力に着手済みか」の判定は renderer が
      // `.length` で行う（件数も計算値なので main では作らない）
      scores: true,
    },
  },
  // maxScore(coursework_total) を追加クエリ無しで算出するための元データ。
  coursework: { include: { items: true } },
  // estimationMode="selected" のとき推定に使う他データソース（旧 estimationSourceIds のJSON配列）
  estimationSources: { orderBy: { order: "asc" } },
} satisfies Prisma.GradeDataSourceInclude

/**
 * GradeItem を dataSources 込みで取得する際の include（上記を内包）。
 *
 * 成績境界も行のまま同梱する。規約: 計算は renderer 側で行うので、件数を数えるなら
 * `_count` ではなく行を渡し切って renderer で `.length` を取る。
 */
export const gradeItemWithDataSourcesInclude = {
  dataSources: {
    include: gradeDataSourceInclude,
    orderBy: { order: "asc" },
  },
  boundaries: { orderBy: { order: "asc" } },
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
    sourceDataSourceId,
    order: index,
  }))
}

/**
 * gradeDataSourceInclude で取得し、`serializePrisma` を通した DataSource（集計元同梱）の型。
 *
 * ハイドレートは IPC へ返す直前だけで行うので、入力は常にシリアライズ済み
 * （Decimal は number）である。`Serialized<>` を被せておくことで、通し忘れた行を
 * そのまま渡すと型検査で落ちる。
 */
type SerializedGradeDataSource = Serialized<
  Prisma.GradeDataSourceGetPayload<{
    include: typeof gradeDataSourceInclude
  }>
>

/**
 * serialize 済み DataSource に、仮想フィールド maxScore を（同梱済み元データから）付与する。
 * レンダラへ返す全経路で必ず通す。
 *
 * 推定に使う他データソース（estimationSources）は中間テーブルの行をそのまま渡す。
 * 旧 estimationSourceIds（JSON配列）と違い FK で守られているため、参照先が消えれば
 * 行ごと消える。
 *
 * 参照先（exam / subtotal / cropRegion / coursework）は include の出力をそのまま持つ。
 * 以前はここで列を絞り直していたが、それは規約の禁じる縮小射影で、満点の元データを
 * 落とすと renderer 側で算出できなくなる。
 */
function hydrateGradeDataSource(dataSource: SerializedGradeDataSource) {
  return {
    ...dataSource,
    type: toGradeDataSourceType(dataSource.type),
    maxScore: computeMaxScoreFromPayload(dataSource),
  }
}

type GradeItemWithDataSources = { dataSources: SerializedGradeDataSource[] }

/** GradeItem 1件の dataSources を全てハイドレートする。 */
export function hydrateGradeItem<GI extends GradeItemWithDataSources>(
  gradeItem: GI
) {
  return {
    ...gradeItem,
    dataSources: gradeItem.dataSources.map(hydrateGradeDataSource),
  }
}

/** GradeItem 配列を全てハイドレートする。 */
export function hydrateGradeItems<GI extends GradeItemWithDataSources>(
  gradeItems: GI[]
) {
  return gradeItems.map(hydrateGradeItem)
}

/** Grade 全体（gradeItems[].dataSources[]）をハイドレートする。 */
export function hydrateGrade<
  G extends { gradeItems: GradeItemWithDataSources[] },
>(grade: G) {
  return { ...grade, gradeItems: hydrateGradeItems(grade.gradeItems) }
}

/**
 * GradeItem配下のデータソース一覧を取得
 */
export async function getDataSourcesByGradeItemId(gradeItemId: string) {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: { gradeItemId },
    include: gradeDataSourceInclude,
    orderBy: { order: "asc" },
  })
  return serializePrisma(dataSources).map(hydrateGradeDataSource)
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
  // order を自動計算（gradeItem 内）
  const maxOrder = await prisma.gradeDataSource.aggregate({
    where: { gradeItemId: data.gradeItemId },
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? -1) + 1

  // 自分自身を集計元に選ぶのを弾くため、作成前に自分のidを確定させる
  const dataSourceId = crypto.randomUUID()

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

  return hydrateGradeDataSource(serializePrisma(dataSource))
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
  const { estimationSourceIds, ...rest } = data
  const updateData: Prisma.GradeDataSourceUpdateInput = { ...rest }
  if (estimationSourceIds !== undefined) {
    // 選択の総入れ替え。idは uuidv4 なので、選び直すと別idの行になる。
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

  return hydrateGradeDataSource(serializePrisma(dataSource))
}

/**
 * データソースを削除
 */
export async function deleteDataSource(id: string) {
  const before = await prisma.gradeDataSource.findUnique({
    where: { id },
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
}

/**
 * データソースの並び順を更新
 */
export async function reorderDataSources(
  dataSourceOrders: { id: string; order: number }[]
) {
  await prisma.$transaction(
    dataSourceOrders.map((dataSourceOrder) =>
      prisma.gradeDataSource.update({
        where: { id: dataSourceOrder.id },
        data: { order: dataSourceOrder.order },
      })
    )
  )
}

/**
 * 全試験試験候補を取得（SubtotalGroupフィルタなし）
 */
export async function getExamCandidates() {
  const exams = await prisma.exam.findMany({
    orderBy: { examDate: "desc" },
  })
  return exams
}

/**
 * 試験のSubtotalGroups取得（ExamSubtotalGroup経由）
 */
export async function getExamSubtotalGroups(examId: string) {
  const examSubtotalGroups = await prisma.examSubtotalGroup.findMany({
    where: { examId },
    include: {
      subtotalGroup: {
        include: { subtotals: { orderBy: { order: "asc" } } },
      },
    },
  })
  return examSubtotalGroups.map(
    (examSubtotalGroup) => examSubtotalGroup.subtotalGroup
  )
}

/**
 * 試験のQUESTION_ANSWER型CropRegion一覧を取得。
 *
 * 小計への割り当て（cropSubtotals）まで同梱する。renderer がデータソース追加時の満点を
 * 追加クエリ無しで算出できるようにするため（規約: 計算は renderer 側で行う）。
 */
export async function getExamCropRegions(examId: string) {
  const examPages = await prisma.examPage.findMany({
    where: { examId },
    include: {
      cropRegions: {
        where: { type: "QUESTION_ANSWER" },
        orderBy: { orderIndex: "asc" },
        include: {
          cropSubtotals: {
            where: { assignmentType: "QUESTION_ASSIGNMENT" },
          },
        },
      },
    },
    orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
  })
  const cropRegions = examPages.flatMap((examPage) => examPage.cropRegions)
  return serializePrisma(cropRegions)
}
