/**
 * 成績算出（Grade）で使われている値の編集欄に付けるロックの判定と文言。
 *
 * 材料は試験・資料1件ぶんのデータソース（`GradeLockSource`、main が取る）。
 * 表の行・列・欄ごとに「どのデータソースがこれを使っているか」を返し、空ならロックしない。
 * 解除はその場の state だけで持つ（`useGradeLockUnlocks`）。
 */

import type { GradeLockSource } from "@/types/gradeLock.types"
import type { GradeReferenceDataSourceType } from "@/types/gradeReference.types"

/**
 * 試験の設問（領域情報の行）を使っているデータソース。配点・種類を変えると点数が変わる。
 *
 * - 設問そのもののデータソース
 * - 試験の合計点。合計点に入るのは解答欄（QUESTION_ANSWER）だけなので、その試験の
 *   解答欄はすべて当たる
 * - 小計。その小計へ割り当てた設問だけが当たる
 */
export function findCropRegionLockSources(
  sources: GradeLockSource[],
  cropRegion: { id: string; type: string }
): GradeLockSource[] {
  const isQuestionAnswer = cropRegion.type === "QUESTION_ANSWER"
  return sources.filter((source) => {
    if (source.cropRegionId === cropRegion.id) return true
    if (!isQuestionAnswer) return false
    if (source.dataSourceType === "exam_total") return true
    return (
      source.dataSourceType === "subtotal" &&
      source.subtotalCropRegionIds.includes(cropRegion.id)
    )
  })
}

/** 小計（設問の割り当て表の列）を使っているデータソース。割り当てを変えると小計が変わる */
export function findSubtotalLockSources(
  sources: GradeLockSource[],
  subtotalId: string
): GradeLockSource[] {
  return sources.filter(
    (source) =>
      source.dataSourceType === "subtotal" && source.subtotalId === subtotalId
  )
}

/**
 * 評価項目を使っているデータソース。満点・入力方式・文字評価の換算表を変えると点数が変わる。
 * 資料合計は資料の評価項目をすべて足すので、どの評価項目にも当たる。
 */
export function findCourseworkItemLockSources(
  sources: GradeLockSource[],
  courseworkItemId: string
): GradeLockSource[] {
  return sources.filter(
    (source) =>
      source.courseworkItemId === courseworkItemId ||
      source.dataSourceType === "coursework_total"
  )
}

/**
 * 受験状態を使っているデータソース。
 *
 * 受験状態が点数に効くのは「見込」を欠測とするデータソースだけ（成績算出はその試験の
 * 受験状態が「見込」なら点数を空として扱う）。算出は `examId` を持つデータソースでしか
 * 見ないので、同じ条件で拾う。
 */
export function findExpectedAsMissingLockSources(
  sources: GradeLockSource[],
  examId: string
): GradeLockSource[] {
  return sources.filter(
    (source) => source.treatExpectedAsMissing && source.examId === examId
  )
}

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
 * @param subject ロックしている欄を言う主語（「この設問の配点・種類」など）
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
