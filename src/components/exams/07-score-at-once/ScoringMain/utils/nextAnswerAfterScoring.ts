/**
 * 採点した後に選ぶ答案（一覧表示と AI採点モードで同じ規則）。
 *
 * - 選んでいた答案のうち、**並びで最後のもの**の次の答案（複数選んでいても1つにする）
 * - 模範解答（id が `master-` で始まる）は飛ばす
 * - 次が無ければ（末尾まで来たら）null。呼び出し側は選択をそのまま残す
 *
 * 並びは**書き込む前**のものを渡すこと。採点した答案が絞り込みから外れると並びが詰まり、
 * 書き込んだ後の並びでは「最後に選んでいた答案」の位置が分からなくなる
 */
export function findNextAnswerIdAfterScoring(
  orderedAnswerIds: readonly string[],
  scoredAnswerIds: ReadonlySet<string>
): string | null {
  const lastScoredIndex = orderedAnswerIds.reduce(
    (lastIndex, answerId, index) =>
      scoredAnswerIds.has(answerId) ? index : lastIndex,
    -1
  )
  if (lastScoredIndex < 0) return null
  return (
    orderedAnswerIds
      .slice(lastScoredIndex + 1)
      .find((answerId) => !answerId.startsWith("master-")) ?? null
  )
}
