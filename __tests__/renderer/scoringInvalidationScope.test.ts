// @vitest-environment jsdom
/**
 * **1マス採点したときに取り直すのは、その設問のキーだけ。**
 *
 * 採点行は長らく採点領域（`CropRegion`）の木に子として載っており、採点の書き込みは
 * その木を丸ごと取り直していた。データのいちばん重い試験で、1打鍵ごとに
 * 多数行・大きな JSON。**画面に出ているのは1設問ぶん（1設問ぶん）**なので、40倍を運んで
 * いたことになる。
 *
 * 取り直しはキーより細かくできない（`queryFn` を呼び直す＝その値を丸ごと作り直す）
 * ので、狭めるにはキーを割るしかない。ここで固定するのは**割れていること**で、
 * 「別の設問まで巻き込んでいない」が本体の主張になる。
 */

import type { MutationKey } from "@tanstack/react-query"
import { MutationObserver } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { examForDetailQuery } from "../../src/queries/exam"
import { createAppQueryClient } from "../../src/queries/queryClient"
import type { AppMutationMeta } from "../../src/queries/registerMeta"
import {
  batchUpdateQuestionScoresMutation,
  examDecisionSummaryQuery,
  finalizeQuestionScoreMutation,
  questionScoresQuery,
  setQuestionScoreCommentMutation,
  setQuestionScoreMutation,
  updateQuestionScoreMutation,
} from "../../src/queries/scoring"

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const EXAM_ID = "exam-1"
const SCORED_REGION_ID = "region-scored"
const OTHER_REGION_ID = "region-other"
const USER_ID = "user-1"

/** 取り直しの行き先だけを見たいので、境界は「何か返す」以上のことをしない */
const electronAPI = {
  getQuestionScoresByCropRegionId: vi.fn(async () => []),
  getQuestionAnswerRegionsByExamId: vi.fn(async () => []),
  getExamDecisionSummary: vi.fn(async () => ({})),
  fetchExamById: vi.fn(async () => ({})),
}

beforeEach(() => {
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    value: electronAPI,
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
  vi.clearAllMocks()
})

/**
 * 採点の周りで生きているキャッシュを一通り温めて、書き込みを1回走らせる。
 *
 * 返すのは「どのキーが古くなったか」。`invalidateQueries` は画面に出ていない
 * クエリを取り直さない（印だけ付ける）ので、`isInvalidated` で見るのがいちばん
 * 素直に「取り直す気になったか」を表す。
 */
async function runAndCollectStaleness(built: {
  mutationKey?: MutationKey
  meta: AppMutationMeta
}) {
  const client = createAppQueryClient()

  const scoredScores = questionScoresQuery(EXAM_ID, SCORED_REGION_ID)
  const otherScores = questionScoresQuery(EXAM_ID, OTHER_REGION_ID)
  const decisionSummary = examDecisionSummaryQuery(EXAM_ID, USER_ID)
  const forDetail = examForDetailQuery(EXAM_ID)
  const regions = [
    ...scoredScores.queryKey.slice(0, 2),
    "questionAnswerRegions",
  ]

  await Promise.all([
    client.fetchQuery(scoredScores),
    client.fetchQuery(otherScores),
    client.fetchQuery(decisionSummary),
    client.fetchQuery(forDetail),
    client.fetchQuery({
      queryKey: regions,
      queryFn: () => electronAPI.getQuestionAnswerRegionsByExamId(),
    }),
  ])

  // 書き込みそのものは何もしない。ここで見たいのは**宣言**（`meta.invalidates` と、
  // 連打をまとめる `mutationKey`）が中央の後始末にどう効くかで、書き込みの中身は
  // 取り直しの行き先を変えないため
  const observer = new MutationObserver(client, {
    mutationKey: built.mutationKey,
    mutationFn: async () => undefined,
    meta: built.meta,
  })
  await observer.mutate().catch(() => {
    // 取り直しは成否によらず走る（`onSettled`）ので、失敗しても続ける
  })

  const isStale = (queryKey: readonly unknown[]) =>
    client.getQueryState(queryKey)?.isInvalidated === true

  return {
    採点した設問: isStale(scoredScores.queryKey),
    別の設問: isStale(otherScores.queryKey),
    採点領域: isStale(regions),
    裁定サマリ: isStale(decisionSummary.queryKey),
    概要: isStale(forDetail.queryKey),
  }
}

describe("採点の書き込みが取り直す範囲", () => {
  it("採点すると、その設問だけが古くなる", async () => {
    const stale = await runAndCollectStaleness(
      setQuestionScoreMutation(EXAM_ID, SCORED_REGION_ID)
    )

    expect(stale).toEqual({
      採点した設問: true,
      // ここが本体。木に載せていた頃は、全設問ぶんを取り直していた
      別の設問: false,
      採点領域: false,
      裁定サマリ: false,
      概要: false,
    })
  })

  it("採点の書き換えも、その設問だけ", async () => {
    const stale = await runAndCollectStaleness(
      updateQuestionScoreMutation(EXAM_ID, SCORED_REGION_ID)
    )

    expect(stale.採点した設問).toBe(true)
    expect(stale.別の設問).toBe(false)
  })

  it("覚え書きも、その設問だけ", async () => {
    const stale = await runAndCollectStaleness(
      setQuestionScoreCommentMutation(EXAM_ID, SCORED_REGION_ID)
    )

    expect(stale.採点した設問).toBe(true)
    expect(stale.別の設問).toBe(false)
  })

  it("OMR の一括取り込みは、書く先を設問に絞れないので全部", async () => {
    const stale = await runAndCollectStaleness(
      batchUpdateQuestionScoresMutation(EXAM_ID)
    )

    expect(stale.採点した設問).toBe(true)
    expect(stale.別の設問).toBe(true)
    // 採点領域そのものは変わらない（採点行しか書いていない）
    expect(stale.採点領域).toBe(false)
  })

  it("確定は採点行を書かないので、採点行を取り直さない", async () => {
    const stale = await runAndCollectStaleness(
      finalizeQuestionScoreMutation(EXAM_ID)
    )

    expect(stale).toEqual({
      採点した設問: false,
      別の設問: false,
      採点領域: false,
      // 古くなるのは裁定サマリと、確定を読んで「要裁定」を数える概要の2つ
      裁定サマリ: true,
      概要: true,
    })
  })
})

describe("採点行のキーは設問ごとに分かれている", () => {
  it("設問が違えば別のキーになる", () => {
    expect(questionScoresQuery(EXAM_ID, SCORED_REGION_ID).queryKey).not.toEqual(
      questionScoresQuery(EXAM_ID, OTHER_REGION_ID).queryKey
    )
  })

  it("どちらも試験のまとまりの下にある（試験を消せば一緒に消える）", () => {
    const key = questionScoresQuery(EXAM_ID, SCORED_REGION_ID).queryKey

    expect(key.slice(0, 2)).toEqual(["exam", EXAM_ID])
  })
})
