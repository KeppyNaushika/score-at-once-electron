/**
 * 成績算出（Grade）から使われているものを消すときの文言。
 *
 * 調べるのは main（`electron-src/lib/prisma/gradeReference.ts`）。試験・資料の削除を
 * main が断る文言と、確認画面が前もって見せる文言を同じにするため、ここ1箇所で作る。
 */

import type {
  GradeReference,
  GradeReferenceTarget,
} from "@/types/gradeReference.types"

/** 成績算出の名前を重複なく並べる（出てきた順） */
export function listReferencingGradeNames(
  references: GradeReference[]
): string[] {
  return [...new Set(references.map((reference) => reference.gradeName))]
}

/** 「成績算出「A」の評価項目「B」のデータソース「C」」 */
function describeDataSource(reference: GradeReference): string {
  return `成績算出「${reference.gradeName}」の評価項目「${reference.gradeItemName}」のデータソース「${reference.dataSourceName}」`
}

const toBulletLines = (lines: string[]): string =>
  lines.map((line) => `・${line}`).join("\n")

/** 消させないもの */
type BlockedTargetKind = Extract<
  GradeReferenceTarget["kind"],
  "exam" | "coursework" | "subtotalGroup" | "student"
>

const BLOCKED_TARGET_LABEL: Record<BlockedTargetKind, string> = {
  exam: "試験",
  coursework: "試験外成績資料",
  subtotalGroup: "小計点グループ",
  student: "生徒",
}

/**
 * 試験・試験外成績資料が成績算出で使われていて消せないことを伝える文言。
 * 使われていなければ null。
 */
export function buildDeletionBlockedMessage(
  kind: BlockedTargetKind,
  references: GradeReference[]
): string | null {
  if (references.length === 0) return null
  const label = BLOCKED_TARGET_LABEL[kind]
  if (kind === "student") {
    // 生徒はデータソースではなく名簿（usage: roster）で使われる
    return (
      `この${label}は次の成績算出の名簿に載っているため、削除できません。` +
      `削除するには、先に各成績算出の「1. 生徒管理」でこの${label}を名簿から外してください。\n` +
      toBulletLines(
        listReferencingGradeNames(references).map(
          (gradeName) => `成績算出「${gradeName}」`
        )
      )
    )
  }
  return (
    `この${label}は次の成績算出で使われているため、削除できません。` +
    `削除するには、先に各成績算出の「2. データソース」でこの${label}を使っているデータソースを削除してください。\n` +
    toBulletLines(references.map(describeDataSource))
  )
}

/** 消せるが警告するもの */
type WarnedTargetKind = Extract<
  GradeReferenceTarget["kind"],
  "cropRegion" | "subtotal" | "courseworkItem" | "examPage"
>

const WARNED_TARGET_LABEL: Record<WarnedTargetKind, string> = {
  cropRegion: "設問",
  examPage: "模範解答ページ",
  subtotal: "小計項目",
  courseworkItem: "評価項目",
}

/** 1件のデータソースに起きることを言う */
function describeEffect(
  kind: WarnedTargetKind,
  reference: GradeReference
): string {
  const dataSource = describeDataSource(reference)
  if (reference.usage === "total") {
    const totalLabel =
      reference.dataSourceType === "exam_total"
        ? "試験の合計点"
        : reference.dataSourceType === "subtotal"
          ? "小計"
          : "資料合計"
    return `${dataSource}（${totalLabel}）の点数が変わります`
  }
  switch (kind) {
    case "cropRegion":
      return `${dataSource}（この設問）が削除されます`
    case "examPage":
      // ページを消すと上の設問が Cascade で消え、設問のデータソースも消える
      return `${dataSource}（このページの設問）が削除されます`
    case "subtotal":
      return `${dataSource}（この小計項目）が削除されます`
    case "courseworkItem":
      // coursework データソースは SetNull。行は残るが参照先が空になる
      return `${dataSource}（この評価項目）が参照先を失い、点数を取り込めなくなります`
  }
}

/**
 * 設問・小計項目・評価項目を消すと成績算出に起きることを伝える文言。
 * 使われていなければ null。
 */
export function buildItemDeletionWarning(
  kind: WarnedTargetKind,
  references: GradeReference[]
): string | null {
  if (references.length === 0) return null
  const label = WARNED_TARGET_LABEL[kind]
  return (
    `この${label}は成績算出で使われています。削除すると次のようになります。` +
    `削除した後は、各成績算出の「2. データソース」と結果を確認してください。\n` +
    toBulletLines(
      references.map((reference) => describeEffect(kind, reference))
    )
  )
}

/** 名簿から生徒を外すと点数が欠測になるもの */
type RosterRemovalTargetKind = Extract<
  GradeReferenceTarget["kind"],
  "exam" | "coursework"
>

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
  references: GradeReference[]
): string | null {
  const gradeNames = listReferencingGradeNames(references)
  if (gradeNames.length === 0) return null
  const { target, roster } = ROSTER_REMOVAL_LABEL[kind]
  return (
    `この${target}は次の成績算出で使われています。` +
    `${roster}から外した生徒は、各成績算出でこの${target}の点数が欠測になります` +
    `（その成績算出の名簿に載っている場合）。\n` +
    toBulletLines(gradeNames.map((gradeName) => `成績算出「${gradeName}」`))
  )
}
