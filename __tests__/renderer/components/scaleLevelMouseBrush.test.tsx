// @vitest-environment jsdom
/**
 * 07 のマウスモードの類型のブラシ（docs/vlm-grading-design.md §4-8-6）。
 *
 * ここで固定すること:
 * - 類型方式の設問のブラシは、選択・類型ごとのブラシ（記号・点数）・保留・無答・Wマークの順に並び、
 *   正答・誤答・部分点・部分点入力のブラシは出さない。点の採点の設問はこれまでどおり
 * - 類型のブラシを選ぶと、ブラシと類型を一緒に決める（類型の id を文字列に埋め込まない）
 * - 「表示中の未採点N件を〇〇にする」は類型の記号で出し、付けられないブラシでは出さない
 * - 効くブラシの読み替え: 点の採点の設問・消えた類型・類型方式の設問の正答などは「選択」として読む
 * - 類型のブラシでクリックした答案（選択ではない）に類型を書き、「いま採点した」印を付ける。
 *   同じ類型が付いていれば未採点に戻す。答案に設問のページが無ければ書かない
 * - 表示中の未採点の一括も、類型のブラシなら類型を書く
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { act, render, renderHook, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ScaleQuestionState } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import { effectiveMouseBrushOf } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleMouseBrush"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useGuardedScoring } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGuardedScoring"
import { MouseBrushControls } from "@/components/exams/07-score-at-once/ScoringSidePanel/MouseBrushControls"
import type {
  MouseBrushAction,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { PublicUser } from "@/queries/user"
import { DEFAULT_CLICK_SCORING_CONFIG } from "@/types/clickScoring.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeQuestionScore,
  makeStudentAnswerImage,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const scaleCropRegion: QuestionAnswerRegionRow = {
  id: CROP_REGION_ID,
  examPageId: EXAM_PAGE_ID,
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: 10,
  orderIndex: 0,
  scoringMethod: "scale",
  scoreScaleId: "scale-1",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  examPage: {
    id: EXAM_PAGE_ID,
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  cropSubtotals: [],
}

const scaleLevels = [
  { id: "level-a", label: "A", description: "根拠を2つ以上挙げている", score: 10 },
  { id: "level-b", label: "B", description: "根拠を1つ挙げている", score: 6 },
  { id: "level-c", label: "C", description: "根拠が無い", score: 3 },
]

const scaleQuestion: ScaleQuestionState = {
  isScaleQuestion: true,
  scaleLevels,
  isScaleLevelsLoading: false,
}

const notScaleQuestion: ScaleQuestionState = {
  isScaleQuestion: false,
  scaleLevels: [],
  isScaleLevelsLoading: false,
}

const answerImage1 = makeStudentAnswerImage("exam-student-1")
const answerImage2 = makeStudentAnswerImage("exam-student-2")

const fakeApi = {
  settings: {
    getUserPreference: vi.fn(async () => null),
    listUserScoringStatusColors: vi.fn(async () => []),
  },
  setScaleLevels: vi.fn(async () => []),
  setQuestionScore: vi.fn(async () => ({})),
  updateQuestionScore: vi.fn(async () => ({ status: "ok" })),
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, "electronAPI", {
    value: fakeApi,
    writable: true,
    configurable: true,
  })
})

/** 取得と利用者の Provider。QueryClient はテストごとに新しくする（描き直しのたびには作らない） */
function makeProviders() {
  const QueryWrapper = createQueryWrapper()
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <CurrentUserProvider user={currentUser}>
          <ShortcutProvider>{children}</ShortcutProvider>
        </CurrentUserProvider>
      </QueryWrapper>
    )
  }
}

describe("効くブラシの読み替え", () => {
  it("類型方式の設問で類型表にある類型のブラシは、そのまま効く", () => {
    expect(
      effectiveMouseBrushOf({
        mouseBrush: "scale_level",
        mouseScaleLevelId: "level-b",
        isScaleQuestion: true,
        scaleLevels,
      })
    ).toEqual({ mouseBrush: "scale_level", mouseScaleLevelId: "level-b" })
  })

  it("点の採点の設問・類型表に無い類型（消えた・別の類型表）の類型のブラシは「選択」として読む", () => {
    const select = { mouseBrush: "select", mouseScaleLevelId: null }
    expect(
      effectiveMouseBrushOf({
        mouseBrush: "scale_level",
        mouseScaleLevelId: "level-b",
        isScaleQuestion: false,
        scaleLevels: [],
      })
    ).toEqual(select)
    expect(
      effectiveMouseBrushOf({
        mouseBrush: "scale_level",
        mouseScaleLevelId: "level-gone",
        isScaleQuestion: true,
        scaleLevels,
      })
    ).toEqual(select)
    expect(
      effectiveMouseBrushOf({
        mouseBrush: "scale_level",
        mouseScaleLevelId: null,
        isScaleQuestion: true,
        scaleLevels,
      })
    ).toEqual(select)
  })

  it("類型方式の設問では正答・誤答・部分点・部分点入力のブラシを「選択」として読み、保留・無答・Wマークは効く", () => {
    const pointBrushes: MouseBrushAction[] = [
      "correct",
      "incorrect",
      "partial",
      "partial_modal",
    ]
    pointBrushes.forEach((mouseBrush) =>
      expect(
        effectiveMouseBrushOf({
          mouseBrush,
          mouseScaleLevelId: null,
          isScaleQuestion: true,
          scaleLevels,
        }).mouseBrush
      ).toBe("select")
    )
    const compatibleBrushes: MouseBrushAction[] = [
      "select",
      "pending",
      "no_answer",
      "double_mark",
    ]
    compatibleBrushes.forEach((mouseBrush) =>
      expect(
        effectiveMouseBrushOf({
          mouseBrush,
          mouseScaleLevelId: null,
          isScaleQuestion: true,
          scaleLevels,
        }).mouseBrush
      ).toBe(mouseBrush)
    )
  })

  it("点の採点の設問では、正答などのブラシはそのまま効く", () => {
    expect(
      effectiveMouseBrushOf({
        mouseBrush: "correct",
        mouseScaleLevelId: null,
        isScaleQuestion: false,
        scaleLevels: [],
      })
    ).toEqual({ mouseBrush: "correct", mouseScaleLevelId: null })
  })
})

function renderBrushControls({
  mouseBrush,
  mouseScaleLevelId = null,
  scale,
}: {
  mouseBrush: MouseBrushAction
  mouseScaleLevelId?: string | null
  scale: ScaleQuestionState
}) {
  const onMouseBrushChange = vi.fn()
  const onMouseScaleLevelSelect = vi.fn()
  const onBatchScoreVisibleUnscored = vi.fn()
  const Providers = makeProviders()
  render(
    <Providers>
      <MouseBrushControls
        mouseBrush={mouseBrush}
        onMouseBrushChange={onMouseBrushChange}
        mouseScaleLevelId={mouseScaleLevelId}
        onMouseScaleLevelSelect={onMouseScaleLevelSelect}
        scaleQuestion={scale}
        visibleUnscoredCount={3}
        hiddenUnscoredCount={0}
        onBatchScoreVisibleUnscored={onBatchScoreVisibleUnscored}
      />
    </Providers>
  )
  const group = screen.getByRole("radiogroup", {
    name: "クリック時の採点ブラシ",
  })
  return {
    group,
    onMouseBrushChange,
    onMouseScaleLevelSelect,
    onBatchScoreVisibleUnscored,
  }
}

describe("類型方式の設問のブラシの並び", () => {
  it("選択・類型ごとのブラシ・保留・無答・Wマークを並べ、正答・誤答・部分点・部分点入力は出さない", () => {
    const { group } = renderBrushControls({
      mouseBrush: "select",
      scale: scaleQuestion,
    })

    const items = within(group).getAllByRole("radio")
    expect(items.map((item) => item.textContent)).toEqual([
      "選択",
      "A10点",
      "B6点",
      "C3点",
      "保留",
      "無答",
      "Wマーク",
    ])
    for (const label of ["正答", "誤答", "部分点", "部分点入力"]) {
      expect(within(group).queryByText(label)).not.toBeInTheDocument()
    }
  })

  it("類型のブラシを押すと、その類型を選ぶ", async () => {
    const { group, onMouseScaleLevelSelect, onMouseBrushChange } =
      renderBrushControls({ mouseBrush: "select", scale: scaleQuestion })

    await userEvent.click(within(group).getByLabelText("類型 B（6点）"))

    expect(onMouseScaleLevelSelect).toHaveBeenCalledWith("level-b")
    expect(onMouseBrushChange).not.toHaveBeenCalled()
  })

  it("選んでいる類型のブラシが押された見た目になり、一括は類型の記号で出す", async () => {
    const { group, onBatchScoreVisibleUnscored } = renderBrushControls({
      mouseBrush: "scale_level",
      mouseScaleLevelId: "level-b",
      scale: scaleQuestion,
    })

    // ツールチップの trigger が data-state を上書きするので、選ばれているかは aria-checked で見る
    expect(within(group).getByLabelText("類型 B（6点）")).toHaveAttribute(
      "aria-checked",
      "true"
    )
    const batchButton = screen.getByRole("button", {
      name: "表示中の未採点3件をBにする",
    })
    await userEvent.click(batchButton)
    expect(onBatchScoreVisibleUnscored).toHaveBeenCalledWith("scale_level")
  })

  it("選択のブラシでは一括を出さない", () => {
    renderBrushControls({ mouseBrush: "select", scale: scaleQuestion })

    expect(
      screen.queryByRole("button", { name: /表示中の未採点/ })
    ).not.toBeInTheDocument()
  })

  it("点の採点の設問では、これまでどおり正答・部分点入力のブラシを並べ、類型のブラシは出さない", () => {
    const { group } = renderBrushControls({
      mouseBrush: "correct",
      scale: notScaleQuestion,
    })

    expect(within(group).getByText("正答")).toBeInTheDocument()
    expect(within(group).getByText("部分点入力")).toBeInTheDocument()
    expect(within(group).queryByLabelText(/^類型/)).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "表示中の未採点3件を正答にする" })
    ).toBeInTheDocument()
  })
})

function makeScoringData(
  answerId: string,
  examStudentId: string,
  status: ScoringStatus
): ScoringData {
  return {
    id: answerId,
    examStudentId,
    studentName: `生徒 ${examStudentId}`,
    imageUrl: `appimg:///answers/${examStudentId}.png`,
    maxScore: 10,
    status,
    questionRegion: scaleCropRegion,
    customOrder: 0,
  }
}

const noop = () => {}

/** 類型方式の設問の採点の口を、マウスモードの類型のブラシ（類型 B）を選んだ一覧表示として載せる */
function renderGuardedScoring({
  allScoringData,
  questionScores = [],
  isCurrentQuestionPageMissing = false,
}: {
  allScoringData: ScoringData[]
  questionScores?: QuestionScoreRow[]
  isCurrentQuestionPageMissing?: boolean
}) {
  const setRecentlyScoredAnswers = vi.fn()
  const { result } = renderHook(
    () =>
      useGuardedScoring({
        scoringData: {
          examId: "exam-1",
          currentUserId: CURRENT_USER_ID,
          currentCropRegionId: CROP_REGION_ID,
          studentAnswerImages: [answerImage1, answerImage2],
          cropRegions: [scaleCropRegion],
          questionScoresByCropRegionId: new Map([
            [CROP_REGION_ID, questionScores],
          ]),
        },
        progress: {
          // 選択はクリックした答案と別にしておく（類型は選択ではなくクリックした答案へ書く）
          selectedAnswers: new Set([answerImage2.id]),
          gradingMode: "grid",
          scoringBehavior: "next-student",
          setRecentlyScoredAnswers,
          getGridAnswerData: () => [],
          setSelectedAnswers: noop,
          handleNextStudent: noop,
          handleNextQuestion: noop,
        },
        clickScoring: {
          clickScoringConfig: DEFAULT_CLICK_SCORING_CONFIG,
          allScoringData,
          filteredScoringDataIds: allScoringData.map(
            (scoringData) => scoringData.id
          ),
          replaceSelection: noop,
          setGradingMode: noop,
          mouseScaleLevelId: "level-b",
        },
        currentCropRegion: scaleCropRegion,
        scaleQuestion,
        isCurrentQuestionPageMissing,
      }),
    { wrapper: makeProviders() }
  )
  return { result, setRecentlyScoredAnswers }
}

describe("類型のブラシでの採点", () => {
  it("クリックした答案に類型を書き、「いま採点した」印を付ける", async () => {
    const { result, setRecentlyScoredAnswers } = renderGuardedScoring({
      allScoringData: [
        makeScoringData(answerImage1.id, "exam-student-1", "unscored"),
      ],
    })

    await act(async () => {
      result.current.handleMouseScoring(answerImage1.id, "scale_level", true)
    })

    expect(fakeApi.setScaleLevels).toHaveBeenCalledWith({
      cropRegionId: CROP_REGION_ID,
      examStudentIds: ["exam-student-1"],
      scaleLevelId: "level-b",
    })
    expect(setRecentlyScoredAnswers).toHaveBeenCalledTimes(1)
    expect(fakeApi.setQuestionScore).not.toHaveBeenCalled()
    expect(fakeApi.updateQuestionScore).not.toHaveBeenCalled()
  })

  it("同じ類型が付いていれば未採点に戻す", async () => {
    const ownScore = makeQuestionScore({
      examStudentId: "exam-student-1",
      status: "evaluated",
      scaleLevelId: "level-b",
    })
    const { result } = renderGuardedScoring({
      allScoringData: [
        makeScoringData(answerImage1.id, "exam-student-1", "evaluated"),
      ],
      questionScores: [ownScore],
    })

    await act(async () => {
      result.current.handleMouseScoring(answerImage1.id, "scale_level", true)
    })

    expect(fakeApi.setScaleLevels).not.toHaveBeenCalled()
    expect(fakeApi.updateQuestionScore).toHaveBeenCalledWith(
      ownScore.id,
      expect.objectContaining({ status: "unscored" })
    )
  })

  it("別の類型が付いていれば、ブラシの類型に付け替える", async () => {
    const { result } = renderGuardedScoring({
      allScoringData: [
        makeScoringData(answerImage1.id, "exam-student-1", "evaluated"),
      ],
      questionScores: [
        makeQuestionScore({
          examStudentId: "exam-student-1",
          status: "evaluated",
          scaleLevelId: "level-a",
        }),
      ],
    })

    await act(async () => {
      result.current.handleMouseScoring(answerImage1.id, "scale_level", true)
    })

    expect(fakeApi.setScaleLevels).toHaveBeenCalledWith(
      expect.objectContaining({ scaleLevelId: "level-b" })
    )
    expect(fakeApi.updateQuestionScore).not.toHaveBeenCalled()
  })

  it("答案に設問のページが無ければ書かず、印も付けない", async () => {
    const { result, setRecentlyScoredAnswers } = renderGuardedScoring({
      allScoringData: [
        makeScoringData(answerImage1.id, "exam-student-1", "unscored"),
      ],
      isCurrentQuestionPageMissing: true,
    })

    await act(async () => {
      result.current.handleMouseScoring(answerImage1.id, "scale_level", true)
    })

    expect(fakeApi.setScaleLevels).not.toHaveBeenCalled()
    expect(setRecentlyScoredAnswers).not.toHaveBeenCalled()
  })

  it("表示中の未採点の一括は、未採点の答案だけに類型を書く", async () => {
    const { result } = renderGuardedScoring({
      allScoringData: [
        makeScoringData(answerImage1.id, "exam-student-1", "unscored"),
        makeScoringData(answerImage2.id, "exam-student-2", "pending"),
      ],
    })

    await act(async () => {
      result.current.handleBatchScoreVisibleUnscored("scale_level")
    })

    expect(fakeApi.setScaleLevels).toHaveBeenCalledWith({
      cropRegionId: CROP_REGION_ID,
      examStudentIds: ["exam-student-1"],
      scaleLevelId: "level-b",
    })
  })
})
