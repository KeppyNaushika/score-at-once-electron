/**
 * 選択から、今の行に無い id を落とす。
 *
 * 一覧の選択は id で持つので、行が消えても（削除・同期で他端末が消した・担当が
 * 移って選べなくなった）id だけが選択に残る。残ったまま一括操作をすると、消えた
 * 行へ書きに行く。選択の状態を書き直すのではなく、**読むたびに今の行と突き合わせる**
 * （消えた選択を状態へ書き戻さない。`docs/coding-style.md`「派生に落とす」）。
 *
 * 何も落ちないときは受け取った Set をそのまま返す（依存配列で参照を見ている呼び手が
 * 毎回作り直さないように）。
 */
export function pruneSelectedIds(
  selectedIds: Set<string>,
  selectableRows: { id: string }[]
): Set<string> {
  const selectableIds = new Set(selectableRows.map((row) => row.id))
  const existingSelectedIds = [...selectedIds].filter((selectedId) =>
    selectableIds.has(selectedId)
  )
  return existingSelectedIds.length === selectedIds.size
    ? selectedIds
    : new Set(existingSelectedIds)
}
