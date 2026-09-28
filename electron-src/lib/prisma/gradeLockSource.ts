/**
 * 試験・試験外成績資料を使っている成績算出（Grade）のデータソースを取る。
 *
 * 使われている試験・資料は画面ごと（全タブ）ロックするので、要るのは「使っているか」と
 * 確認で見せる一覧だけ。どの欄が効くかは見分けない。
 * 削除の確認（`gradeReference.ts`）と同じ条件・並びで拾う。
 */

import type { Prisma } from "@prisma/client"

import type {
  GradeLockSource,
  GradeLockTarget,
} from "../../../src/types/gradeLock.types"
import prisma from "./client"
import { toDataSourceType } from "./gradeReference"

/** 成績算出の名前 → 評価項目 → データソースの順（削除の確認と同じ並び） */
const orderBy = [
  { gradeItem: { grade: { name: "asc" } } },
  { gradeItem: { order: "asc" } },
  { order: "asc" },
] satisfies Prisma.GradeDataSourceOrderByWithRelationInput[]

const include = {
  gradeItem: {
    include: { grade: true, _count: { select: { frozenScores: true } } },
  },
} satisfies Prisma.GradeDataSourceInclude

type DataSourceWithGrade = Prisma.GradeDataSourceGetPayload<{
  include: typeof include
}>

const toGradeLockSource = (
  dataSource: DataSourceWithGrade
): GradeLockSource => ({
  gradeId: dataSource.gradeItem.grade.id,
  gradeName: dataSource.gradeItem.grade.name,
  gradeItemName: dataSource.gradeItem.name,
  dataSourceId: dataSource.id,
  dataSourceName: dataSource.name,
  dataSourceType: toDataSourceType(dataSource.type),
  frozenScoreCount: dataSource.gradeItem._count.frozenScores,
})

/**
 * 試験を使っているデータソース。
 *
 * 試験そのもの（合計点・小計）と、その試験の設問を指すもの。設問のデータソースは
 * examId を冗長に持つが、持たない行があっても設問から辿って拾う（削除の確認と同じ）。
 */
async function getExamGradeLockSources(
  examId: string
): Promise<GradeLockSource[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: {
      OR: [{ examId }, { cropRegion: { examPage: { examId } } }],
    },
    include,
    orderBy,
  })
  return dataSources.map(toGradeLockSource)
}

/** 試験外成績資料を使っているデータソース（評価項目1つずつと、資料合計） */
async function getCourseworkGradeLockSources(
  courseworkId: string
): Promise<GradeLockSource[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: {
      OR: [{ courseworkItem: { courseworkId } }, { courseworkId }],
    },
    include,
    orderBy,
  })
  return dataSources.map(toGradeLockSource)
}

/** 試験・資料1件を使っているデータソース。空なら使われていない */
export function getGradeLockSources(
  target: GradeLockTarget
): Promise<GradeLockSource[]> {
  return target.kind === "exam"
    ? getExamGradeLockSources(target.examId)
    : getCourseworkGradeLockSources(target.courseworkId)
}
