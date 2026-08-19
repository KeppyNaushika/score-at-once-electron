/**
 * 並びの位置（`order` 列）の書き込みを1箇所に置く。
 *
 * **削除と並べ替えで、位置を決める側が違う**（docs/asb-ipc-split-plan.md §4.2）。
 * 削除の後に残る並びは既存の `order` で決まっているので main が詰め直し、並べ替えの
 * 新しい並びは画面にしか無いので renderer が id の並びで渡す。どちらも最後は
 * 「0..n-1 を順に振る」に落ちるので、振る処理はここが持つ。
 */

/**
 * `orderedIds` の並びへ並べ替える。
 *
 * 並びに無い行は末尾へ元の順で残す。渡された並びが古い（他端末が足した行を知らない）
 * ときに、その行を落としたり位置を失ったりしないため。
 */
export function sortRowsByIds<Row extends { id: string }>(
  rows: Row[],
  orderedIds: string[]
): Row[] {
  const position = new Map(orderedIds.map((id, index) => [id, index]))
  return [...rows].sort(
    (rowA, rowB) =>
      (position.get(rowA.id) ?? orderedIds.length) -
      (position.get(rowB.id) ?? orderedIds.length)
  )
}

/**
 * 渡された並びのとおりに `order` を 0..n-1 で振り直す。**動いた行だけ**を書く。
 *
 * 全行を書くと、位置の変わらなかった行まで `updatedAt` が動く（同期は行ごとの LWW
 * なので、相手の編集をその行ごと倒す。`rowDiff.ts` を参照）。
 *
 * @returns 1行でも書いたら `true`
 */
export async function writeRowOrders(
  rows: { id: string; order: number }[],
  update: (id: string, order: number) => Promise<unknown>
): Promise<boolean> {
  let changed = false
  for (const [order, row] of rows.entries()) {
    if (row.order === order) continue
    await update(row.id, order)
    changed = true
  }
  return changed
}
