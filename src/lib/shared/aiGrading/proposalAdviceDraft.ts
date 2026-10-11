/**
 * 問いかけで教員が直している助言の文（AiRubricProposalAdviceDraft）のうち、いま効いているもの
 * （docs/vlm-grading-design.md §3-5）。renderer（助言の欄の文）と main（確定で項目の助言にする文）で同じ決め方をする。
 *
 * - 同じ案・同じ教員の行が複数あれば（一意制約を置かないので、端末をまたぐと起こりうる）、updatedAt の新しい方
 * - その案の答えを最後に確定したより前の行は効かない。確定で項目の助言になったか、確定のあとに項目の助言を
 *   直したかのどちらかで、どちらでも今の項目の助言が正しい（古い文で項目の助言を上書きしない）
 */

interface AdviceDraftLike {
  id: string
  adviceText: string
  updatedAt: Date
}

interface ProposalResponseLike {
  committedAt: Date | null
}

/** 効いている直した助言の文。直していなければ null（"" は助言なし） */
export function effectiveProposalAdviceDraftText(
  adviceDrafts: readonly AdviceDraftLike[],
  committedResponses: readonly ProposalResponseLike[]
): string | null {
  const lastCommittedTime = Math.max(
    -Infinity,
    ...committedResponses.flatMap((response) =>
      response.committedAt === null
        ? []
        : [new Date(response.committedAt).getTime()]
    )
  )
  // main（electron-src）の型の版でも使えるよう toSorted は使わない
  const latestDraft = adviceDrafts.reduce<AdviceDraftLike | null>(
    (latest, adviceDraft) => {
      if (!latest) return adviceDraft
      const timeDifference =
        new Date(adviceDraft.updatedAt).getTime() -
        new Date(latest.updatedAt).getTime()
      return timeDifference > 0 ||
        (timeDifference === 0 && adviceDraft.id.localeCompare(latest.id) > 0)
        ? adviceDraft
        : latest
    },
    null
  )
  if (!latestDraft) return null
  // 同じ時刻（ミリ秒）は効くほうに倒す（確定の直前に直した文を落とさない。確定の直後なら項目の助言と同じ文）
  return new Date(latestDraft.updatedAt).getTime() >= lastCommittedTime
    ? latestDraft.adviceText
    : null
}
