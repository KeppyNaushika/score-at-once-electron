/**
 * 成績算出（Grade）のデータソースから、試験・試験外成績資料とその中の項目が
 * 使われているかを調べる。
 *
 * 試験・資料は使われていれば消させない（削除の関数が最終判定にここを使う）。
 * 設問（採点領域）・小計項目・評価項目は消せるが、確認画面で影響を見せる。
 *
 * データソースの参照は schema の `onDelete` で黙って変わる（設問・小計は Cascade で
 * データソースごと消え、試験・評価項目・資料は SetNull で参照が空になる）。消した後
 * からは何が起きたか分からないので、**消す前に**ここで調べる。
 */

import type { Prisma } from "@prisma/client"

import type {
  GradeReference,
  GradeReferenceDataSourceType,
  GradeReferenceTarget,
  GradeReferenceUsage,
} from "../../../src/types/gradeReference.types"
import prisma from "./client"

const dataSourceWithGradeInclude = {
  gradeItem: { include: { grade: true } },
} satisfies Prisma.GradeDataSourceInclude

type DataSourceWithGrade = Prisma.GradeDataSourceGetPayload<{
  include: typeof dataSourceWithGradeInclude
}>

const DATA_SOURCE_TYPES = [
  "exam_total",
  "subtotal",
  "crop_region",
  "coursework",
  "coursework_total",
] as const

export const toDataSourceType = (type: string): GradeReferenceDataSourceType =>
  DATA_SOURCE_TYPES.find((knownType) => knownType === type) ?? "other"

/** 使われ方ごとの検索条件 */
type UsageQuery = {
  usage: GradeReferenceUsage
  where: Prisma.GradeDataSourceWhereInput
}

/** 対象ごとに「どのデータソースが、どう使っているか」の検索条件を作る */
async function buildUsageQueries(
  client: Prisma.TransactionClient,
  target: GradeReferenceTarget
): Promise<UsageQuery[]> {
  switch (target.kind) {
    case "exam":
      // 試験そのもの（合計点・小計）と、その試験の設問を指すもの。設問のデータソースは
      // examId を冗長に持つが、持たない行があっても設問から辿って拾う
      return [
        {
          usage: "direct",
          where: {
            OR: [
              { examId: target.id },
              { cropRegion: { examPage: { examId: target.id } } },
            ],
          },
        },
      ]
    case "cropRegion": {
      const cropRegion = await client.cropRegion.findUnique({
        where: { id: target.id },
        select: { type: true, examPage: { select: { examId: true } } },
      })
      if (!cropRegion) return []
      const examId = cropRegion.examPage.examId
      return [
        { usage: "direct", where: { cropRegionId: target.id } },
        // 試験の合計点に入るのは解答欄（QUESTION_ANSWER）だけ（examScoreCalculator）
        ...(cropRegion.type === "QUESTION_ANSWER"
          ? [
              {
                usage: "total" as const,
                where: { type: "exam_total", examId },
              },
            ]
          : []),
        {
          usage: "total",
          where: {
            type: "subtotal",
            examId,
            subtotal: { cropSubtotals: { some: { cropRegionId: target.id } } },
          },
        },
      ]
    }
    case "subtotal":
      return [{ usage: "direct", where: { subtotalId: target.id } }]
    case "examPage": {
      // ページを消すと上の設問が Cascade で消える。設問1つずつの判定（cropRegion）を
      // ページ上の設問すべてへ広げたもの
      const examPage = await client.examPage.findUnique({
        where: { id: target.id },
        select: {
          examId: true,
          cropRegions: {
            where: { type: "QUESTION_ANSWER" },
            select: { id: true },
          },
        },
      })
      if (!examPage) return []
      const onThisPage = { examPageId: target.id }
      return [
        { usage: "direct", where: { cropRegion: onThisPage } },
        ...(examPage.cropRegions.length > 0
          ? [
              {
                usage: "total" as const,
                where: { type: "exam_total", examId: examPage.examId },
              },
            ]
          : []),
        {
          usage: "total",
          where: {
            type: "subtotal",
            examId: examPage.examId,
            subtotal: { cropSubtotals: { some: { cropRegion: onThisPage } } },
          },
        },
      ]
    }
    case "coursework":
      // 評価項目を1つずつ使うものと、資料全体を「資料合計」として使うもの
      return [
        {
          usage: "direct",
          where: {
            OR: [
              { courseworkItem: { courseworkId: target.id } },
              { courseworkId: target.id },
            ],
          },
        },
      ]
    case "subtotalGroup":
      // グループの中の小計項目を使うもの（小計項目は Cascade で消え、データソースも消える）
      return [
        {
          usage: "direct",
          where: { subtotal: { subtotalGroupId: target.id } },
        },
      ]
    case "student":
      // データソースではなく名簿で調べる（findGradeReferences が別に扱う）
      return []
    case "courseworkItem": {
      const courseworkItem = await client.courseworkItem.findUnique({
        where: { id: target.id },
        select: { courseworkId: true },
      })
      if (!courseworkItem) return []
      return [
        { usage: "direct", where: { courseworkItemId: target.id } },
        {
          usage: "total",
          where: {
            type: "coursework_total",
            courseworkId: courseworkItem.courseworkId,
          },
        },
      ]
    }
  }
}

const toGradeReference = (
  dataSource: DataSourceWithGrade,
  usage: GradeReferenceUsage
): GradeReference => ({
  gradeId: dataSource.gradeItem.grade.id,
  gradeName: dataSource.gradeItem.grade.name,
  gradeItemName: dataSource.gradeItem.name,
  dataSourceId: dataSource.id,
  dataSourceName: dataSource.name,
  dataSourceType: toDataSourceType(dataSource.type),
  usage,
})

/**
 * 生徒が載っている成績算出の名簿を返す（成績算出の名前順）。
 *
 * 生徒を消すと名簿（GradeStudent）が Cascade で消え、その生徒の手動点数・上書き・
 * 確定値も一緒に消える。
 */
async function findGradeRosterReferences(
  client: Prisma.TransactionClient,
  studentId: string
): Promise<GradeReference[]> {
  const gradeStudents = await client.gradeStudent.findMany({
    where: { studentId },
    include: { grade: { select: { id: true, name: true } } },
    orderBy: { grade: { name: "asc" } },
  })
  return gradeStudents.map((gradeStudent) => ({
    gradeId: gradeStudent.grade.id,
    gradeName: gradeStudent.grade.name,
    gradeItemName: "",
    dataSourceId: "",
    dataSourceName: "",
    dataSourceType: "other",
    usage: "roster",
  }))
}

/**
 * 対象を使っている成績算出のデータソースを返す。
 *
 * 同じデータソースが「そのもの」と「合計に含まれる」の両方に当たることは無いが、
 * 念のため先に当たった方（そのもの）を残す。並びは成績算出の名前 → 評価項目 →
 * データソースの順。
 *
 * @param client 削除のトランザクションの中で調べるときは tx を渡す
 */
export async function findGradeReferences(
  target: GradeReferenceTarget,
  client: Prisma.TransactionClient = prisma
): Promise<GradeReference[]> {
  if (target.kind === "student") {
    return findGradeRosterReferences(client, target.id)
  }
  const usageQueries = await buildUsageQueries(client, target)
  const references: GradeReference[] = []
  const seenDataSourceIds = new Set<string>()
  for (const usageQuery of usageQueries) {
    const dataSources = await client.gradeDataSource.findMany({
      where: usageQuery.where,
      include: dataSourceWithGradeInclude,
      orderBy: [
        { gradeItem: { grade: { name: "asc" } } },
        { gradeItem: { order: "asc" } },
        { order: "asc" },
      ],
    })
    for (const dataSource of dataSources) {
      if (seenDataSourceIds.has(dataSource.id)) continue
      seenDataSourceIds.add(dataSource.id)
      references.push(toGradeReference(dataSource, usageQuery.usage))
    }
  }
  return references
}
