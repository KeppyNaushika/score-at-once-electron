/**
 * 統合アーカイブ（.sao）の試し取り込みで、成績算出が読む表へ書いた行の「前」と「後」を控える
 *
 * 確認の段で「この取り込みで値が変わる成績算出と評価項目」を示すための材料
 * （docs/unified-archive-design.md §7.5）。**差分は取らない。** 取り込み先の行を
 * SQLite に入っているまま返し、どの列が変わったか・どの評価項目に効くかは renderer が導く。
 *
 * - 対象は成績算出が読む表（`GRADE_CALCULATION_TABLES`）の、作る・置き換える行だけ。残す行と
 *   取り込まない行は載せない
 * - 「前」は書く直前の取り込み先の行（作る行は null）。付け替えは表を決める段で済んでいるので、
 *   付け替えた行は付け替え後の id で引ける
 * - 「後」は書いた直後に同じ方法で引き直した行。「前」と同じ形（SQLite の値のまま）で比べられる
 */

import { GRADE_CALCULATION_TABLES } from "../../prisma/gradeWriteLock"
import type { ArchiveTargetConnection } from "./archiveRowImporter"
import type { PlannedRow } from "./archiveRowPlanning"
import { fetchTargetRows, type TargetRow } from "./archiveTargetRows"

/** 成績算出が読む表へ書いた1行の、書く前と書いた後 */
export interface ArchiveGradeInputChange {
  readonly table: string
  readonly id: string
  /** 書く前の取り込み先の行。作る行は null */
  readonly before: TargetRow | null
  readonly after: TargetRow
}

/**
 * 1表分の書き込み（`write`）を挟んで、作る・置き換える行の前と後を引く。
 * 成績算出が読まない表は控えずに書くだけ
 */
export async function captureGradeInputChanges(
  target: ArchiveTargetConnection,
  table: string,
  plans: readonly PlannedRow[],
  write: () => Promise<void>
): Promise<ArchiveGradeInputChange[]> {
  const writtenPlans = plans.filter((plan) => plan.kind !== "keep")
  if (!GRADE_CALCULATION_TABLES.has(table) || writtenPlans.length === 0) {
    await write()
    return []
  }
  const beforeRows = await fetchTargetRows(
    target,
    table,
    writtenPlans
      .filter((plan) => plan.kind === "replace")
      .map((plan) => plan.targetId)
  )
  await write()
  const afterRows = await fetchTargetRows(
    target,
    table,
    writtenPlans.map((plan) => plan.targetId)
  )
  return writtenPlans.flatMap((plan) => {
    const after = afterRows.get(plan.targetId)
    if (after === undefined) return []
    return [
      {
        table,
        id: plan.targetId,
        before: beforeRows.get(plan.targetId) ?? null,
        after,
      },
    ]
  })
}
