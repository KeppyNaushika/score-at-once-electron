/**
 * 一覧で選んでいるものとして扱う答案（AI採点モードと 8. 採点確定で同じ規則）。
 *
 * 利用者が選んだ答案のうち、表示に残っているもの。1つも残らなければ先頭の答案を
 * 選んでいるものとする（一覧表示と同じ）。
 *
 * Ctrl/Cmd+クリックの足し引きも、選んだ答案だけでなくこの選択から始めること。
 * 選んだ答案だけから足すと、何も選んでいないときに見えていた先頭の答案が選択から落ちる
 */
export function effectiveSelection(
  chosenIds: ReadonlySet<string>,
  visibleIds: readonly string[]
): Set<string> {
  const stillVisible = visibleIds.filter((id) => chosenIds.has(id))
  return new Set(
    stillVisible.length > 0 ? stillVisible : visibleIds.slice(0, 1)
  )
}
