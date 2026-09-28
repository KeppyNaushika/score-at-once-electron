/**
 * 成績算出（Grade）で使われている試験・資料のロックを解除する前の、確認の文言。
 *
 * 材料は試験・資料1件を使っているデータソースの一覧（`GradeLockSource`、main が取る）。
 * 空ならロックしない。ロックそのもの（書き込みを止める・解除を覚える）は
 * `src/lib/gradeWriteLock.ts` と `GradeLockProvider` が持つ。
 */

import type { GradeLockSource } from "@/types/gradeLock.types"
import type { GradeReferenceDataSourceType } from "@/types/gradeReference.types"

const DATA_SOURCE_TYPE_LABEL: Record<GradeReferenceDataSourceType, string> = {
  exam_total: "試験の合計点",
  subtotal: "小計",
  crop_region: "設問",
  coursework: "評価項目",
  coursework_total: "資料合計",
  other: "その他",
}

/** 確認の表の1行。評価項目とデータソースの組 */
export interface GradeLockMessageRow {
  gradeItemName: string
  dataSourceName: string
  /** データソースの種類（「試験の合計点」など） */
  dataSourceTypeLabel: string
}

/** 成績算出1つぶんのまとまり */
export interface GradeLockMessageGroup {
  gradeId: string
  gradeName: string
  rows: GradeLockMessageRow[]
}

/** 確認で見せる文言 */
export interface GradeLockMessage {
  /** 何がどう使われていて、変えると何が起きるか */
  lead: string
  /**
   * 使っているデータソースを成績算出ごとにまとめたもの。1行ずつ文にすると
   * 成績算出名が毎行くり返されて読みにくいので、表にして見せる。
   * 成績算出も行も、最初に出てきた順（同じ評価項目・データソースの組は畳む）
   */
  groups: GradeLockMessageGroup[]
  /** 確定済みの成績について */
  frozenNote: string
}

/** データソースを成績算出ごとにまとめる */
export function groupGradeLockSources(
  sources: GradeLockSource[]
): GradeLockMessageGroup[] {
  const groups = new Map<
    string,
    GradeLockMessageGroup & { keys: Set<string> }
  >()
  for (const source of sources) {
    let group = groups.get(source.gradeId)
    if (group === undefined) {
      group = {
        gradeId: source.gradeId,
        gradeName: source.gradeName,
        rows: [],
        keys: new Set(),
      }
      groups.set(source.gradeId, group)
    }
    const row: GradeLockMessageRow = {
      gradeItemName: source.gradeItemName,
      dataSourceName: source.dataSourceName,
      dataSourceTypeLabel: DATA_SOURCE_TYPE_LABEL[source.dataSourceType],
    }
    const key = JSON.stringify(row)
    if (group.keys.has(key)) continue
    group.keys.add(key)
    group.rows.push(row)
  }
  return [...groups.values()].map(({ keys: _keys, ...group }) => group)
}

/**
 * ロックを解除する前の確認の文言。
 *
 * @param subject ロックしているものを言う主語（「この試験」など）
 */
export function buildGradeLockMessage(
  subject: string,
  sources: GradeLockSource[]
): GradeLockMessage {
  return {
    lead: `${subject}は、次の成績算出で使われています。変えると、その成績の点数が変わります。`,
    groups: groupGradeLockSources(sources),
    frozenNote:
      "成績算出で確定済みの値は変わりませんが、「確定後に元データが変わっています」と表示されるようになります。",
  }
}

/** 未取得のときに毎回新しい配列を作らないための空値（書き換えない） */
export const NO_GRADE_LOCK_SOURCES: GradeLockSource[] = []
