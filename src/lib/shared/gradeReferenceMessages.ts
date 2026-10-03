/**
 * 試験・試験外成績資料とその中の項目が、成績算出（Grade）からどう使われているか。
 *
 * 材料は、試験・資料・小計点グループ・生徒の詳細に include で同梱したデータソース
 * （`electron-src/lib/prisma/gradeDataSourceUsage.ts` の形）。使われているかを調べる
 * 専用の問い合わせは持たず、ここで同梱の中身から導く。
 *
 * 試験・資料の削除を main が断る文言と、確認画面が前もって見せる文言を同じにするため、
 * renderer と main の両方がここを使う。
 */

import type {
  CropRegion,
  CropSubtotal,
  ExamPage,
  Grade,
  GradeDataSource,
  GradeFrozenScore,
  GradeItem,
} from "@prisma/client"

import {
  type GradeDataSourceType,
  toGradeDataSourceType,
} from "@/types/grade.types"

import { gradeWorkflowSteps, workflowStep } from "./workflowSteps"

/** 断りの文言で外し方を案内する段の名前（タブと同じ名前で呼ぶ） */
const STUDENTS_STEP_LABEL = workflowStep(
  gradeWorkflowSteps,
  "01-students"
).label
const DATA_SOURCES_STEP_LABEL = workflowStep(
  gradeWorkflowSteps,
  "02-data-sources"
).label

/** 評価項目（成績算出・確定値つき）を同梱したデータソース */
export type UsingGradeDataSource = Pick<
  GradeDataSource,
  "id" | "type" | "name" | "order" | "subtotalId"
> & {
  gradeItem: Pick<GradeItem, "id" | "name" | "order"> & {
    grade: Pick<Grade, "id" | "name">
    frozenScores: Pick<GradeFrozenScore, "id">[]
  }
}

interface WithGradeDataSources {
  gradeDataSources: UsingGradeDataSource[]
}

/**
 * データソースが対象をどう使っているか。
 *
 * - `direct`: 対象そのものを指している（設問・小計・評価項目のデータソース）
 * - `total`: 対象がデータソースの合計に含まれている（設問が「試験の合計点」や
 *   小計に、評価項目が「資料合計」に）。消すと合計が変わる
 */
export interface GradeDataSourceUsage {
  dataSource: UsingGradeDataSource
  usage: "direct" | "total"
}

/** データソースの種類の表示名 */
export const GRADE_DATA_SOURCE_TYPE_LABEL: Record<GradeDataSourceType, string> =
  {
    exam_total: "試験の合計点",
    subtotal: "小計",
    crop_region: "設問",
    coursework: "評価項目",
    coursework_total: "資料合計",
    manual: "手動入力（旧形式）",
  }

/** 同じデータソースは1つにし、成績算出の名前 → 評価項目 → データソースの順に並べる */
function sortUnique(
  dataSources: UsingGradeDataSource[]
): UsingGradeDataSource[] {
  const byId = new Map<string, UsingGradeDataSource>()
  for (const dataSource of dataSources) {
    if (!byId.has(dataSource.id)) byId.set(dataSource.id, dataSource)
  }
  return [...byId.values()].sort(
    (dataSourceA, dataSourceB) =>
      dataSourceA.gradeItem.grade.name.localeCompare(
        dataSourceB.gradeItem.grade.name
      ) ||
      dataSourceA.gradeItem.order - dataSourceB.gradeItem.order ||
      dataSourceA.order - dataSourceB.order
  )
}

// =============================================================================
// 同梱の中身から、使っているデータソースを導く
// =============================================================================

type CropRegionWithUsage = Pick<CropRegion, "id" | "type"> &
  WithGradeDataSources & {
    cropSubtotals: Pick<CropSubtotal, "subtotalId">[]
  }

/** 試験の詳細に同梱したもの（`examGradeUsageInclude`） */
type ExamWithUsage = WithGradeDataSources & {
  examPages: (Pick<ExamPage, "id"> & {
    cropRegions: CropRegionWithUsage[]
  })[]
}

/** 試験外成績資料の詳細に同梱したもの（`courseworkGradeUsageInclude`） */
type CourseworkWithUsage = WithGradeDataSources & {
  items: (WithGradeDataSources & { id: string })[]
}

/** 試験を使っているデータソース（試験そのもの・その設問を指すもの） */
export function examUsingDataSources(
  exam: ExamWithUsage
): UsingGradeDataSource[] {
  return sortUnique([
    ...exam.gradeDataSources,
    ...exam.examPages.flatMap((examPage) =>
      examPage.cropRegions.flatMap((cropRegion) => cropRegion.gradeDataSources)
    ),
  ])
}

/** 試験外成績資料を使っているデータソース（資料合計と、評価項目1つずつ） */
export function courseworkUsingDataSources(
  coursework: CourseworkWithUsage
): UsingGradeDataSource[] {
  return sortUnique([
    ...coursework.gradeDataSources,
    ...coursework.items.flatMap((item) => item.gradeDataSources),
  ])
}

/** 小計点グループの中の小計項目を使っているデータソース */
export function subtotalGroupUsingDataSources(subtotalGroup: {
  subtotals: WithGradeDataSources[]
}): UsingGradeDataSource[] {
  return sortUnique(
    subtotalGroup.subtotals.flatMap((subtotal) => subtotal.gradeDataSources)
  )
}

/** 並べたうえで、先に当たった方（そのもの）を残す */
function toUsages(
  direct: UsingGradeDataSource[],
  total: UsingGradeDataSource[]
): GradeDataSourceUsage[] {
  const directIds = new Set(direct.map((dataSource) => dataSource.id))
  return [
    ...sortUnique(direct).map((dataSource) => ({
      dataSource,
      usage: "direct" as const,
    })),
    ...sortUnique(total)
      .filter((dataSource) => !directIds.has(dataSource.id))
      .map((dataSource) => ({ dataSource, usage: "total" as const })),
  ]
}

/**
 * 設問の集まりを消すと影響を受けるデータソース。
 *
 * 設問を指すものは消え（Cascade）、試験の合計点（解答欄が含まれるとき。
 * examScoreCalculator）と、設問を含む小計は点数が変わる。
 */
function cropRegionsUsages(
  exam: ExamWithUsage,
  cropRegions: CropRegionWithUsage[]
): GradeDataSourceUsage[] {
  const subtotalIds = new Set(
    cropRegions.flatMap((cropRegion) =>
      cropRegion.cropSubtotals.map((cropSubtotal) => cropSubtotal.subtotalId)
    )
  )
  const hasAnswerRegion = cropRegions.some(
    (cropRegion) => cropRegion.type === "QUESTION_ANSWER"
  )
  return toUsages(
    cropRegions.flatMap((cropRegion) => cropRegion.gradeDataSources),
    exam.gradeDataSources.filter(
      (dataSource) =>
        (hasAnswerRegion && dataSource.type === "exam_total") ||
        (dataSource.type === "subtotal" &&
          dataSource.subtotalId !== null &&
          subtotalIds.has(dataSource.subtotalId))
    )
  )
}

/** 設問を消すと影響を受けるデータソース */
export function cropRegionUsages(
  exam: ExamWithUsage,
  cropRegionId: string
): GradeDataSourceUsage[] {
  return cropRegionsUsages(
    exam,
    exam.examPages
      .flatMap((examPage) => examPage.cropRegions)
      .filter((cropRegion) => cropRegion.id === cropRegionId)
  )
}

/** 模範解答ページを消すと影響を受けるデータソース（上の設問が Cascade で消える） */
export function examPageUsages(
  exam: ExamWithUsage,
  examPageId: string
): GradeDataSourceUsage[] {
  return cropRegionsUsages(
    exam,
    exam.examPages
      .filter((examPage) => examPage.id === examPageId)
      .flatMap((examPage) => examPage.cropRegions)
  )
}

/** 小計項目を消すと影響を受けるデータソース（小計を指すものが Cascade で消える） */
export function subtotalUsages(
  subtotal: WithGradeDataSources
): GradeDataSourceUsage[] {
  return toUsages(subtotal.gradeDataSources, [])
}

/** 評価項目を消すと影響を受けるデータソース（項目を指すものと、資料合計） */
export function courseworkItemUsages(
  coursework: CourseworkWithUsage,
  courseworkItemId: string
): GradeDataSourceUsage[] {
  return toUsages(
    coursework.items
      .filter((item) => item.id === courseworkItemId)
      .flatMap((item) => item.gradeDataSources),
    coursework.gradeDataSources.filter(
      (dataSource) => dataSource.type === "coursework_total"
    )
  )
}

// =============================================================================
// 文言
// =============================================================================

/** 成績算出の名前を重複なく並べる（出てきた順） */
export function listReferencingGradeNames(
  dataSources: UsingGradeDataSource[]
): string[] {
  return [
    ...new Set(
      dataSources.map((dataSource) => dataSource.gradeItem.grade.name)
    ),
  ]
}

/** 「成績算出「A」の評価項目「B」のデータソース「C」」 */
function describeDataSource(dataSource: UsingGradeDataSource): string {
  return `成績算出「${dataSource.gradeItem.grade.name}」の評価項目「${dataSource.gradeItem.name}」のデータソース「${dataSource.name}」`
}

const toBulletLines = (lines: string[]): string =>
  lines.map((line) => `・${line}`).join("\n")

/** 使われていれば消させないもの */
type BlockedTargetKind = "exam" | "coursework" | "subtotalGroup"

const BLOCKED_TARGET_LABEL: Record<BlockedTargetKind, string> = {
  exam: "試験",
  coursework: "試験外成績資料",
  subtotalGroup: "小計点グループ",
}

/**
 * 試験・試験外成績資料・小計点グループが成績算出で使われていて消せないことを
 * 伝える文言。使われていなければ null。
 */
export function buildDeletionBlockedMessage(
  kind: BlockedTargetKind,
  dataSources: UsingGradeDataSource[]
): string | null {
  if (dataSources.length === 0) return null
  const label = BLOCKED_TARGET_LABEL[kind]
  return (
    `この${label}は次の成績算出で使われているため、削除できません。` +
    `削除するには、先に各成績算出の「${DATA_SOURCES_STEP_LABEL}」でこの${label}を使っているデータソースを削除してください。\n` +
    toBulletLines(dataSources.map(describeDataSource))
  )
}

/**
 * 生徒が成績算出の名簿に載っていて消せないことを伝える文言。載っていなければ null。
 *
 * 生徒を消すと名簿（GradeStudent）が Cascade で消え、その生徒の手動点数・上書き・
 * 確定値も一緒に消える。
 */
export function buildStudentDeletionBlockedMessage(
  gradeStudents: { grade: Pick<Grade, "id" | "name"> }[]
): string | null {
  const gradeNames = [
    ...new Set(gradeStudents.map((gradeStudent) => gradeStudent.grade.name)),
  ].sort((gradeNameA, gradeNameB) => gradeNameA.localeCompare(gradeNameB))
  if (gradeNames.length === 0) return null
  return (
    `この生徒は次の成績算出の名簿に載っているため、削除できません。` +
    `削除するには、先に各成績算出の「${STUDENTS_STEP_LABEL}」でこの生徒を名簿から外してください。\n` +
    toBulletLines(gradeNames.map((gradeName) => `成績算出「${gradeName}」`))
  )
}

/** 消せるが警告するもの */
type WarnedTargetKind =
  "cropRegion" | "examPage" | "subtotal" | "courseworkItem"

const WARNED_TARGET_LABEL: Record<WarnedTargetKind, string> = {
  cropRegion: "設問",
  examPage: "模範解答ページ",
  subtotal: "小計項目",
  courseworkItem: "評価項目",
}

/** 1件のデータソースに起きることを言う */
function describeEffect(
  kind: WarnedTargetKind,
  { dataSource, usage }: GradeDataSourceUsage
): string {
  const described = describeDataSource(dataSource)
  if (usage === "total") {
    const totalLabel =
      GRADE_DATA_SOURCE_TYPE_LABEL[toGradeDataSourceType(dataSource.type)]
    return `${described}（${totalLabel}）の点数が変わります`
  }
  switch (kind) {
    case "cropRegion":
      return `${described}（この設問）が削除されます`
    case "examPage":
      // ページを消すと上の設問が Cascade で消え、設問のデータソースも消える
      return `${described}（このページの設問）が削除されます`
    case "subtotal":
      return `${described}（この小計項目）が削除されます`
    case "courseworkItem":
      // coursework データソースは SetNull。行は残るが参照先が空になる
      return `${described}（この評価項目）が参照先を失い、点数を取り込めなくなります`
  }
}

/**
 * 設問・小計項目・評価項目を消すと成績算出に起きることを伝える文言。
 * 使われていなければ null。
 */
export function buildItemDeletionWarning(
  kind: WarnedTargetKind,
  usages: GradeDataSourceUsage[]
): string | null {
  if (usages.length === 0) return null
  const label = WARNED_TARGET_LABEL[kind]
  return (
    `この${label}は成績算出で使われています。削除すると次のようになります。` +
    `削除した後は、各成績算出の「${DATA_SOURCES_STEP_LABEL}」と結果を確認してください。\n` +
    toBulletLines(usages.map((usage) => describeEffect(kind, usage)))
  )
}

/** 名簿から生徒を外すと点数が欠測になるもの */
type RosterRemovalTargetKind = "exam" | "coursework"

const ROSTER_REMOVAL_LABEL: Record<
  RosterRemovalTargetKind,
  { target: string; roster: string }
> = {
  exam: { target: "試験", roster: "受験生徒" },
  coursework: { target: "試験外成績資料", roster: "対象生徒" },
}

/**
 * 試験の受験生徒・資料の対象生徒から生徒を外すと成績算出に起きることを伝える文言。
 * 使われていなければ null。
 *
 * 外すと生徒の点数（答案・採点、資料の入力値）は消え、データソースは残るので、
 * その生徒の点数は成績算出で欠測になる（成績算出の名簿に載っている場合）。
 */
export function buildRosterRemovalWarning(
  kind: RosterRemovalTargetKind,
  dataSources: UsingGradeDataSource[]
): string | null {
  const gradeNames = listReferencingGradeNames(dataSources)
  if (gradeNames.length === 0) return null
  const { target, roster } = ROSTER_REMOVAL_LABEL[kind]
  return (
    `この${target}は次の成績算出で使われています。` +
    `${roster}から外した生徒は、各成績算出でこの${target}の点数が欠測になります` +
    `（その成績算出の名簿に載っている場合）。\n` +
    toBulletLines(gradeNames.map((gradeName) => `成績算出「${gradeName}」`))
  )
}
