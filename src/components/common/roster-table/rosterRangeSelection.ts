/**
 * Shift+クリックで選ぶ範囲（起点の行から押した行まで、両端を含む）を表示順の
 * studentId の列で返す。
 *
 * 起点は添字でなく studentId で持つ。添字だと、絞り込み・並べ替え・他の教員の
 * 変更で行がずれたあと、起点と違う行から範囲が始まる。起点が表示中に無い
 * （未設定・絞り込みで隠れた・消えた）ときは null を返し、呼び手は単独のトグルにする。
 */
export function rosterRowIdsInRange(
  sortedRowIds: string[],
  anchorRowId: string | null,
  targetRowId: string
): string[] | null {
  if (anchorRowId === null) return null
  const anchorIndex = sortedRowIds.indexOf(anchorRowId)
  const targetIndex = sortedRowIds.indexOf(targetRowId)
  if (anchorIndex === -1 || targetIndex === -1) return null
  return sortedRowIds.slice(
    Math.min(anchorIndex, targetIndex),
    Math.max(anchorIndex, targetIndex) + 1
  )
}
