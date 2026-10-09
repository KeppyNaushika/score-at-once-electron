/**
 * 2段目の指標（docs/vlm-grading-design.md §12）。純粋な関数。
 *
 * - 案の数・取りこぼし（correct でないのにどの案にも入らない答案）・複数の案に入った答案
 * - 純度: 案ごとに、入った答案の教員の判定のうち最も多いものの割合（答案数で重み付け）
 * - 同じ読み取りの同居率: 読み取りが同じ（空白を除いて一致）答案が2件以上ある組のうち、
 *   全員が同じ案の組み合わせに入った組の割合。「同じ誤りが1つの案にまとまるか」の目安
 * - 推奨の一致: 案に1つだけ入った答案で、推奨の選択肢が判定を決める（set）とき、
 *   その判定が教員の判定と一致した割合
 */

export interface Stage2MetricAnswer {
  answerKey: string
  /** 比べる相手の判定（割れた・無いマスは null） */
  referenceStatus: string | null
  aiStatus: string
  transcription: string
}

export interface Stage2MetricProposal {
  memberAnswerKeys: readonly string[]
  recommendedSetStatus: string | null
}

export interface Stage2Metrics {
  answerCount: number
  proposalCount: number
  uncoveredCount: number
  /** どの案にも入らなかった答案（correct を含む） */
  outsideAnyProposalCount: number
  multiMembershipCount: number
  purity: number | null
  sameTranscriptionGroups: number
  sameTranscriptionCohesion: number | null
  recommendedCompared: number
  recommendedMatchRate: number | null
}

const normalizeTranscription = (transcription: string): string =>
  transcription.replace(/[\s　、。,.]/g, "").toLowerCase()

/** 2段目の指標を求める */
export function computeStage2Metrics(input: {
  answers: readonly Stage2MetricAnswer[]
  proposals: readonly Stage2MetricProposal[]
  uncoveredAnswerKeys: readonly string[]
}): Stage2Metrics {
  const { answers, proposals } = input
  const membershipsByAnswer = new Map<string, number[]>()
  proposals.forEach((proposal, proposalIndex) => {
    proposal.memberAnswerKeys.forEach((answerKey) => {
      membershipsByAnswer.set(answerKey, [
        ...(membershipsByAnswer.get(answerKey) ?? []),
        proposalIndex,
      ])
    })
  })
  const referenceByKey = new Map(
    answers.map((answer) => [answer.answerKey, answer.referenceStatus])
  )

  let purityWeight = 0
  let purityMatched = 0
  proposals.forEach((proposal) => {
    const statuses = proposal.memberAnswerKeys.flatMap((answerKey) => {
      const status = referenceByKey.get(answerKey)
      return status ? [status] : []
    })
    if (statuses.length === 0) return
    const counts = statuses.reduce<Map<string, number>>(
      (acc, status) => acc.set(status, (acc.get(status) ?? 0) + 1),
      new Map()
    )
    purityWeight += statuses.length
    purityMatched += Math.max(...counts.values())
  })

  const groups = answers.reduce<Map<string, Stage2MetricAnswer[]>>(
    (acc, answer) => {
      const key = normalizeTranscription(answer.transcription)
      if (key === "") return acc
      return acc.set(key, [...(acc.get(key) ?? []), answer])
    },
    new Map()
  )
  const repeatedGroups = [...groups.values()].filter(
    (group) => group.length >= 2
  )
  const membershipSignature = (answerKey: string) =>
    (membershipsByAnswer.get(answerKey) ?? []).join(",")
  const cohesiveGroups = repeatedGroups.filter((group) =>
    group.every(
      (answer) =>
        membershipSignature(answer.answerKey) ===
        membershipSignature(group[0].answerKey)
    )
  )

  let recommendedCompared = 0
  let recommendedMatched = 0
  answers.forEach((answer) => {
    const memberships = membershipsByAnswer.get(answer.answerKey) ?? []
    if (memberships.length !== 1 || answer.referenceStatus === null) return
    const recommendedSetStatus = proposals[memberships[0]].recommendedSetStatus
    if (recommendedSetStatus === null) return
    recommendedCompared += 1
    if (recommendedSetStatus === answer.referenceStatus) recommendedMatched += 1
  })

  return {
    answerCount: answers.length,
    proposalCount: proposals.length,
    uncoveredCount: input.uncoveredAnswerKeys.length,
    outsideAnyProposalCount: answers.filter(
      (answer) => !membershipsByAnswer.has(answer.answerKey)
    ).length,
    multiMembershipCount: [...membershipsByAnswer.values()].filter(
      (memberships) => memberships.length > 1
    ).length,
    purity: purityWeight === 0 ? null : purityMatched / purityWeight,
    sameTranscriptionGroups: repeatedGroups.length,
    sameTranscriptionCohesion:
      repeatedGroups.length === 0
        ? null
        : cohesiveGroups.length / repeatedGroups.length,
    recommendedCompared,
    recommendedMatchRate:
      recommendedCompared === 0
        ? null
        : recommendedMatched / recommendedCompared,
  }
}
