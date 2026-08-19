/**
 * 並べ替えの結果を「id の並び」で表す。
 *
 * 新しい並びは画面にしか無いので、書き込みへは id の並びを渡す
 * （docs/asb-ipc-split-plan.md §4.2）。添字のまま渡すと、その添字が
 * 「どの行を書くか」の決定に使われる。
 */
export function movedIds(
  items: { id: string }[],
  fromIndex: number,
  toIndex: number
): string[] {
  const ids = items.map((item) => item.id)
  const [moved] = ids.splice(fromIndex, 1)
  ids.splice(toIndex, 0, moved)
  return ids
}
