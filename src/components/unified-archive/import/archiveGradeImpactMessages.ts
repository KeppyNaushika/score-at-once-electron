/**
 * 統合アーカイブ（.sao）の取り込みの確認で、成績算出の値が変わることを伝える文言
 *
 * 材料は `archiveGradeImpact.ts` が導いた、値が変わりそうな成績算出と評価項目。作法は
 * 削除・ロックの確認（`gradeReferenceMessages.ts`・`gradeLock.ts`）に揃える: 何がどう
 * 変わるかを言う一文と、確定済みの評価項目があるときだけの注意。ただし文は取り込み向けに
 * 書く（「削除」「ロック」向けの文言は流用しない）。
 */

import type { ArchiveGradeImpact, ArchiveGradeItemImpact } from "./types"

/** 成績算出の値が変わることを伝える文言 */
export function buildArchiveGradeImpactMessage(
  impacts: readonly ArchiveGradeImpact[]
) {
  const items = impacts.flatMap((impact) => impact.items)
  const hasReplacedFrozen = items.some(
    (item) => item.frozen && item.frozenScoresReplaced
  )
  const hasKeptFrozen = items.some(
    (item) => item.frozen && !item.frozenScoresReplaced
  )
  const frozenNotes: string[] = []
  if (hasKeptFrozen) {
    frozenNotes.push(
      "「確定済み」の評価項目は、確定した値のまま変わりません。取り込むと、成績算出に「確定後に元データが変わっています」と表示され、確定し直すまで新しい値は成績に反映されません。"
    )
  }
  if (hasReplacedFrozen) {
    frozenNotes.push(
      "「確定した値を置き換え」の評価項目は、確定した値そのものがアーカイブの値に置き換わります。"
    )
  }
  return {
    /** 変わるか、変わらないか */
    lead:
      impacts.length === 0
        ? "成績算出の値は変わりません。"
        : "この取り込みで、次の成績算出の値が変わります。取り込んだ後は、各成績算出の結果を確認してください。",
    /**
     * 確定済みの評価項目があるときの注意。無ければ null（確定の話は出さない。出すと、
     * 確定済みの値があって守られるかのように読めるため）
     */
    frozenNote: frozenNotes.length > 0 ? frozenNotes.join("") : null,
  }
}

/** 評価項目の名前に添える印。確定済みでなければ null */
export function archiveGradeItemImpactBadge(
  item: ArchiveGradeItemImpact
): string | null {
  if (!item.frozen) return null
  return item.frozenScoresReplaced ? "確定した値を置き換え" : "確定済み"
}

/** 評価項目より大きな単位で変わること（名簿・成績算出の設定） */
export function archiveGradeWideChanges(impact: ArchiveGradeImpact): string[] {
  const lines: string[] = []
  if (impact.rosterChanged) lines.push("名簿（生徒・在籍・学級）が変わります")
  if (impact.settingsChanged) {
    lines.push("成績算出の設定（基準日・統計対象の学級）が変わります")
  }
  return lines
}
