/**
 * 試験・試験外成績資料を使っている成績算出（Grade）のデータソースを、ロックの判定に
 * 要る参照先ごと1回で取る。
 *
 * 削除の確認（`gradeReference.ts`）は対象1件ずつ調べるが、編集欄のロックは表の全行・
 * 全列に要るので、行ごとに IPC を打たないよう試験・資料1件ぶんをまとめて返す。
 * どの行・列がロックされるかは renderer（`src/lib/gradeLock.ts`）が決める。
 */

import type { Prisma } from "@prisma/client"

import type { GradeLockSource } from "../../../src/types/gradeLock.types"
import prisma from "./client"
import { toDataSourceType } from "./gradeReference"

/** 成績算出の名前 → 評価項目 → データソースの順（削除の確認と同じ並び） */
const orderBy = [
  { gradeItem: { grade: { name: "asc" } } },
  { gradeItem: { order: "asc" } },
  { order: "asc" },
] satisfies Prisma.GradeDataSourceOrderByWithRelationInput[]

const buildInclude = (examId: string | null) =>
  ({
    gradeItem: { include: { grade: true } },
    subtotal: {
      select: {
        cropSubtotals: {
          // 小計の点数に入るのは設問の割り当てだけ（小計点領域の割り当ては効かない）。
          // 小計は試験をまたいで使い回せるので、この試験の設問に絞る
          where: {
            assignmentType: "QUESTION_ASSIGNMENT",
            ...(examId ? { cropRegion: { examPage: { examId } } } : {}),
          },
          select: { cropRegionId: true },
        },
      },
    },
  }) satisfies Prisma.GradeDataSourceInclude

type DataSourceWithLockRelations = Prisma.GradeDataSourceGetPayload<{
  include: ReturnType<typeof buildInclude>
}>

const toGradeLockSource = (
  dataSource: DataSourceWithLockRelations
): GradeLockSource => ({
  gradeId: dataSource.gradeItem.grade.id,
  gradeName: dataSource.gradeItem.grade.name,
  gradeItemName: dataSource.gradeItem.name,
  dataSourceId: dataSource.id,
  dataSourceName: dataSource.name,
  dataSourceType: toDataSourceType(dataSource.type),
  examId: dataSource.examId,
  cropRegionId: dataSource.cropRegionId,
  subtotalId: dataSource.subtotalId,
  courseworkItemId: dataSource.courseworkItemId,
  treatExpectedAsMissing: dataSource.treatExpectedAsMissing,
  subtotalCropRegionIds:
    dataSource.subtotal?.cropSubtotals.map(
      (cropSubtotal) => cropSubtotal.cropRegionId
    ) ?? [],
})

/**
 * 試験を使っているデータソース。
 *
 * 試験そのもの（合計点・小計）と、その試験の設問を指すもの。設問のデータソースは
 * examId を冗長に持つが、持たない行があっても設問から辿って拾う（削除の確認と同じ）。
 */
export async function getExamGradeLockSources(
  examId: string
): Promise<GradeLockSource[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: {
      OR: [{ examId }, { cropRegion: { examPage: { examId } } }],
    },
    include: buildInclude(examId),
    orderBy,
  })
  return dataSources.map(toGradeLockSource)
}

/** 試験外成績資料を使っているデータソース（評価項目1つずつと、資料合計） */
export async function getCourseworkGradeLockSources(
  courseworkId: string
): Promise<GradeLockSource[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: {
      OR: [{ courseworkItem: { courseworkId } }, { courseworkId }],
    },
    include: buildInclude(null),
    orderBy,
  })
  return dataSources.map(toGradeLockSource)
}
