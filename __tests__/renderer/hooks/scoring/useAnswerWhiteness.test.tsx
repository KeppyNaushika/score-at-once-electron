// @vitest-environment jsdom
/**
 * 白さの測定を、どこまで取り直すかの検証。
 *
 * 白さは「どの画像を、どの枠で測ったか」で決まる。キャッシュの鍵が答案の顔ぶれしか
 * 見ていなかったので、02 で解答欄を動かしても測り直さず、**古い矩形で測った値が
 * 使われ続けていた**（足した領域は結果の map に無いので黙って落ちる）。この鍵は
 * 試験のまとまりの外にあり、どの書き込みでも無効化されないため、**入力を鍵で表しきる
 * 以外に手が無い**（docs/branch-review-findings.md #11）。
 */

import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useAnswerWhiteness } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { createQueryWrapper } from "../../../helpers/queryWrapper"

const measure = vi.fn()

beforeEach(() => {
  measure.mockReset()
  measure.mockResolvedValue({ answers: [] })
  Object.defineProperty(window, "electronAPI", {
    value: { measureAnswerWhiteness: measure },
    writable: true,
    configurable: true,
  })
})

const EXAM_PAGE_ID = "page-1"

const answerImage = {
  id: "answer-1",
  imagePath: "data/answers/answer-1.png",
  examPageId: EXAM_PAGE_ID,
} as unknown as StudentAnswerImageWithExamStudents

/** 測る対象の枠。矩形以外はこの検査では見ない */
function region(x: number): QuestionAnswerRegionRow {
  return {
    id: "region-1",
    examPageId: EXAM_PAGE_ID,
    x,
    y: 10,
    width: 100,
    height: 50,
  } as unknown as QuestionAnswerRegionRow
}

/** 渡した矩形で1回描き、測定が走るのを待つ */
function renderWhiteness(cropRegions: QuestionAnswerRegionRow[]) {
  return renderHook(
    (props: { cropRegions: QuestionAnswerRegionRow[] }) =>
      useAnswerWhiteness({
        studentAnswerImages: [answerImage],
        cropRegions: props.cropRegions,
        currentExamPageId: EXAM_PAGE_ID,
        enabled: true,
      }),
    { wrapper: createQueryWrapper(), initialProps: { cropRegions } }
  )
}

describe("白さの測定は、測るもの全部を鍵にする", () => {
  it("採点領域を動かすと測り直す", async () => {
    const { rerender } = renderWhiteness([region(0)])
    await waitFor(() => expect(measure).toHaveBeenCalledTimes(1))

    // 02 で解答欄を右へずらした
    rerender({ cropRegions: [region(40)] })

    await waitFor(() => expect(measure).toHaveBeenCalledTimes(2))
    const [, second] = measure.mock.calls
    expect(second[0].regions[0].x).toBe(40)
  })

  it("採点領域が増えると測り直す", async () => {
    const { rerender } = renderWhiteness([region(0)])
    await waitFor(() => expect(measure).toHaveBeenCalledTimes(1))

    const added = { ...region(0), id: "region-2", y: 200 }
    rerender({ cropRegions: [region(0), added] })

    await waitFor(() => expect(measure).toHaveBeenCalledTimes(2))
    const [, second] = measure.mock.calls
    expect(second[0].regions).toHaveLength(2)
  })

  it("矩形が同じなら測り直さない（設問を切り替えただけでは走らない）", async () => {
    const { rerender } = renderWhiteness([region(0)])
    await waitFor(() => expect(measure).toHaveBeenCalledTimes(1))

    // 同じ内容の別インスタンス。参照が変わっても測り直す理由は無い
    rerender({ cropRegions: [region(0)] })

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(measure).toHaveBeenCalledTimes(1)
  })
})
