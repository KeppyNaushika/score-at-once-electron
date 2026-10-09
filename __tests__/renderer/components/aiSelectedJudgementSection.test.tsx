// @vitest-environment jsdom
/**
 * 07 の AI採点モード、左パネルの採点反映のタブの「選んだ答案の判定」の節。
 *
 * ここで固定すること:
 * - 答案を1つだけ選んでいるとき、表示中の試行の判定・確信度・読み取り・理由を見せる
 *   （点を採用するかを決めるため。朱書きの編集は持ち込まない）
 * - 試行が無ければその旨、0件・複数を選んでいるときは案内文だけを出す
 * - `<` `>` のボタンは古い判定・新しい判定へ動く呼び出しを渡す
 *
 * 行は合成したもので、実データに触れない。
 */

import "../setup"

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AiSelectedJudgementSection } from "@/components/exams/07-score-at-once/AiGrading/AiSelectedJudgementSection"
import type { AiGradingAnswer } from "@/components/exams/07-score-at-once/AiGrading/types"
import { toAiGridItem } from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridItems"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import {
  CROP_REGION_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeAttemptWithRun,
} from "../aiGrading/helpers/aiGradingRowFixtures"

const cropRegion: QuestionAnswerRegionRow = {
  id: CROP_REGION_ID,
  examPageId: EXAM_PAGE_ID,
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: 4,
  orderIndex: 0,
  scoringMethod: "points",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  examPage: {
    id: EXAM_PAGE_ID,
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  cropSubtotals: [],
}

function toGridItem(answer: AiGradingAnswer) {
  const review = reviewAnswer(answer, {
    chosenAttemptIdByExamStudentId: new Map(),
    selectedPromptId: "prompt-1",
    points: 4,
  })
  return toAiGridItem({ answer, review }, cropRegion)
}

function renderSection(answer: AiGradingAnswer | null) {
  const onPrevAttempt = vi.fn()
  const onNextAttempt = vi.fn()
  render(
    <AiSelectedJudgementSection
      singleSelectedItem={answer ? toGridItem(answer) : null}
      promptNumberById={new Map([["prompt-1", 1]])}
      onPrevAttempt={onPrevAttempt}
      onNextAttempt={onNextAttempt}
    />
  )
  return { onPrevAttempt, onNextAttempt }
}

describe("採点反映のタブの「選んだ答案の判定」", () => {
  it("1つだけ選んでいれば、表示中の試行の判定・確信度・読み取り・理由を見せ、朱書きの編集は出さない", () => {
    renderSection(
      makeAnswer("s1", {
        attempts: [
          makeAttemptWithRun({
            examStudentId: "s1",
            status: "incorrect",
            confidence: "low",
            transcription: "x = 3",
            comment: "符号を取り違えている",
          }),
        ],
      })
    )
    const detail = screen.getByLabelText("選んだ答案の AI の判定")
    expect(
      within(detail).getByTestId("ai-attempt-judgement")
    ).toHaveTextContent(/誤答.*確信度/)
    expect(within(detail).getByText("x = 3")).toBeInTheDocument()
    expect(within(detail).getByText("符号を取り違えている")).toBeInTheDocument()
    expect(within(detail).getByText("版 1")).toBeInTheDocument()
    expect(within(detail).getByText("判定 1 / 1")).toBeInTheDocument()
    // 朱書きを直す部品（下書きの案内）は採点反映には持ち込まない
    expect(screen.queryByText(/朱書きの下書き/)).not.toBeInTheDocument()
  })

  it("複数の試行があれば最新を見せ、`<` で古い判定へ動く呼び出しを渡す", async () => {
    const older = makeAttemptWithRun(
      { examStudentId: "s1", id: "attempt-old", comment: "古い理由" },
      { id: "run-old" }
    )
    const newer = makeAttemptWithRun(
      { examStudentId: "s1", id: "attempt-new", comment: "新しい理由" },
      { id: "run-new" }
    )
    const { onPrevAttempt, onNextAttempt } = renderSection(
      makeAnswer("s1", { attempts: [newer, older] })
    )
    expect(screen.getByText("新しい理由")).toBeInTheDocument()
    expect(screen.queryByText("古い理由")).not.toBeInTheDocument()
    expect(screen.getByText("判定 2 / 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "新しい判定" })).toBeDisabled()

    await userEvent.click(screen.getByRole("button", { name: "古い判定" }))
    expect(onPrevAttempt).toHaveBeenCalledTimes(1)
    expect(onNextAttempt).not.toHaveBeenCalled()
  })

  it("試行の無い答案なら、まだ判定が無いことを伝える", () => {
    renderSection(makeAnswer("s1"))
    expect(
      screen.getByText("この答案にはまだ AI の判定がありません")
    ).toBeInTheDocument()
    expect(screen.queryByTestId("ai-attempt-judgement")).not.toBeInTheDocument()
  })

  it("0件・複数を選んでいるときは案内文だけを出す", () => {
    renderSection(null)
    expect(
      screen.getByText("答案を1つだけ選ぶと、AI の判定と理由が見られます")
    ).toBeInTheDocument()
    expect(screen.queryByTestId("ai-attempt-judgement")).not.toBeInTheDocument()
  })
})
