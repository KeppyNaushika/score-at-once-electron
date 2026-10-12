// @vitest-environment jsdom
/**
 * 07 個別表示: 現在の設問のページが答案に無いときは、採点の書き込みを止める（#1485）。
 *
 * ここで固定すること:
 * - 「無い」の判定（`isQuestionPageMissingFromAnswer`）は、読み込んだ画像がその生徒のもの
 *   になってから下す（生徒を切り替えた直後の読み込み中は止めない）
 * - 無い間は、正答などの採点キー・部分点・類型の数字キーが書き込まない。知らせは同じ id で
 *   出し直し、連打しても積もらない
 * - 移動のキー（次の設問・次の生徒）とズームは止めない
 * - ページがあれば、これまでどおり書き込む
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../../setup"

import { act, fireEvent, render, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import type { ScaleQuestionState } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import { isQuestionPageMissingFromAnswer } from "@/components/exams/07-score-at-once/ScoringIndividual/utils/canvasPageLayout"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useGuardedScoring } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGuardedScoring"
import { useScoringShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import { MISSING_ANSWER_PAGE_NOTICE } from "@/components/exams/07-score-at-once/ScoringMain/utils/missingAnswerPageGate"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { PublicUser } from "@/queries/user"
import { DEFAULT_CLICK_SCORING_CONFIG } from "@/types/clickScoring.types"

import { createQueryWrapper } from "../../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  makeStudentAnswerImage,
} from "../../aiGrading/helpers/aiGradingRowFixtures"
import { buildCropRegion } from "./helpers/answerPageFixtures"

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

/** 2ページ目の設問（この生徒の答案には2ページ目が無い、という場面で使う） */
const page2Region = buildCropRegion("page-2", 2, CROP_REGION_ID)

const notScaleQuestion: ScaleQuestionState = {
  isScaleQuestion: false,
  scaleLevels: [],
  isScaleLevelsLoading: false,
}

const scaleQuestion: ScaleQuestionState = {
  isScaleQuestion: true,
  scaleLevels: [
    { id: "level-a", label: "A", description: "", score: 10 },
    { id: "level-b", label: "B", description: "", score: 5 },
  ],
  isScaleLevelsLoading: false,
}

const answerImage = makeStudentAnswerImage("exam-student-1")

const fakeApi = {
  settings: {
    getUserKeyboardShortcuts: vi.fn(async () => ({})),
    setUserKeyboardShortcut: vi.fn(async () => undefined),
    resetUserKeyboardShortcuts: vi.fn(async () => undefined),
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

function renderWithProviders(ui: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>{ui}</ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

const noop = () => {}
const selectedAnswers = new Set([answerImage.id])

/** 移動・ズームの口（呼ばれたかだけを見る） */
const navigation = {
  handleNextQuestion: vi.fn(),
  handleIndividualNavigation: vi.fn(),
  handleZoomIn: vi.fn(),
}

/**
 * 07 の採点の口（`useGuardedScoring`）と採点キー（`useScoringShortcuts`）だけを載せた見本。
 * 1つの答案を選んだ個別表示として動かす
 */
function ScoringKeys({
  isCurrentQuestionPageMissing,
  scale = notScaleQuestion,
}: {
  isCurrentQuestionPageMissing: boolean
  scale?: ScaleQuestionState
}) {
  useContextValue("hasSelectedAnswers", true)
  useContextValue("gradingMode", "individual")
  const scoring = useGuardedScoring({
    scoringData: {
      examId: "exam-1",
      currentUserId: CURRENT_USER_ID,
      currentCropRegionId: page2Region.id,
      studentAnswerImages: [answerImage],
      cropRegions: [page2Region],
      questionScoresByCropRegionId: new Map(),
    },
    progress: {
      selectedAnswers,
      gradingMode: "individual",
      scoringBehavior: "next-student",
      setRecentlyScoredAnswers: noop,
      getGridAnswerData: () => [],
      setSelectedAnswers: noop,
      handleNextStudent: noop,
      handleNextQuestion: noop,
    },
    clickScoring: {
      clickScoringConfig: DEFAULT_CLICK_SCORING_CONFIG,
      allScoringData: [],
      filteredScoringDataIds: [],
      replaceSelection: noop,
      setGradingMode: noop,
      mouseScaleLevelId: null,
    },
    currentCropRegion: page2Region,
    scaleQuestion: scale,
    isCurrentQuestionPageMissing,
  })
  useScoringShortcuts({
    handleToggleStudentNames: noop,
    handleRefreshFilter: noop,
    handleNextQuestion: navigation.handleNextQuestion,
    handlePrevQuestion: noop,
    handleGridNavigation: noop,
    handleIndividualNavigation: navigation.handleIndividualNavigation,
    handleZoomIn: navigation.handleZoomIn,
    handleZoomOut: noop,
    handleResetZoom: noop,
    handlePartialScoreInput: scoring.handlePartialScoreInput,
    handlePartialScoreConfirmPartial: () =>
      scoring.handlePartialScoreConfirm("partial"),
    handlePartialScoreConfirmPending: () =>
      scoring.handlePartialScoreConfirm("pending"),
    handlePartialScoreCancel: scoring.handlePartialScoreCancel,
    handlePartialScoreBackspace: scoring.handlePartialScoreBackspace,
    handleScore: scoring.handleBatchScoreWithProgress,
    handleToggleFilter: noop,
    handleSelectAll: noop,
    handleToggleViewMode: noop,
  })
  return (
    <span data-testid="partial-input">
      {scoring.showPartialScoreModal ? `入力中:${scoring.partialScoreInput}` : ""}
    </span>
  )
}

async function renderScoringKeys(props: {
  isCurrentQuestionPageMissing: boolean
  scale?: ScaleQuestionState
}) {
  const rendered = renderWithProviders(<ScoringKeys {...props} />)
  // キー割当の取得とコマンド登録・コンテキスト反映の effect を落ち着かせる
  await act(async () => {
    await Promise.resolve()
  })
  return rendered
}

function pressKey(key: string, options: { shiftKey?: boolean } = {}) {
  fireEvent.keyDown(document.body, { key, ...options })
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe("現在の設問のページが答案に無いかの判定", () => {
  const base = {
    cropRegion: page2Region,
    examStudentId: "exam-student-1",
    imageLoaded: true,
    loadedExamStudentId: "exam-student-1",
  }

  it("その生徒の答案にページが無ければ、無いと判定する", () => {
    expect(
      isQuestionPageMissingFromAnswer({
        ...base,
        loadedExamPageIds: ["page-1", "page-3"],
      })
    ).toBe(true)
  })

  it("ページがあれば、無いとは言わない", () => {
    expect(
      isQuestionPageMissingFromAnswer({
        ...base,
        loadedExamPageIds: ["page-1", "page-2"],
      })
    ).toBe(false)
  })

  it("読み込んだ画像がまだ前の生徒のもの（読み込み中）なら判定しない", () => {
    expect(
      isQuestionPageMissingFromAnswer({
        ...base,
        loadedExamStudentId: "exam-student-0",
        loadedExamPageIds: ["page-1"],
      })
    ).toBe(false)
  })

  it("画像を1枚も読み込めていない・設問が無いなら判定しない", () => {
    expect(
      isQuestionPageMissingFromAnswer({
        ...base,
        imageLoaded: false,
        loadedExamPageIds: [],
      })
    ).toBe(false)
    expect(
      isQuestionPageMissingFromAnswer({
        ...base,
        cropRegion: null,
        loadedExamPageIds: ["page-1"],
      })
    ).toBe(false)
  })
})

describe("答案に設問のページが無いときの採点キー", () => {
  it("採点キー（正答・誤答・保留・無答・Wマーク）は書かず、知らせを同じ id で出し直す", async () => {
    await renderScoringKeys({ isCurrentQuestionPageMissing: true })

    pressKey("e") // 正答
    pressKey("o") // 誤答
    pressKey("j") // 保留
    pressKey("p") // 無答
    pressKey("u") // Wマーク
    await settle()

    expect(fakeApi.setQuestionScore).not.toHaveBeenCalled()
    expect(fakeApi.updateQuestionScore).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith(MISSING_ANSWER_PAGE_NOTICE, {
      id: "missing-answer-page",
    })
    // 連打しても、知らせはすべて同じ id（sonner が1つにまとめる）
    const toastIds = new Set(
      vi.mocked(toast.info).mock.calls.map(([, options]) => options?.id)
    )
    expect(toastIds).toEqual(new Set(["missing-answer-page"]))
  })

  it("部分点の数字キーは入力を始めない", async () => {
    const { getByTestId } = await renderScoringKeys({
      isCurrentQuestionPageMissing: true,
    })

    pressKey("2")
    await settle()

    expect(getByTestId("partial-input")).toHaveTextContent("")
  })

  it("類型評価の設問の数字キーも類型を書かない", async () => {
    await renderScoringKeys({
      isCurrentQuestionPageMissing: true,
      scale: scaleQuestion,
    })

    pressKey("1")
    await settle()

    expect(fakeApi.setScaleLevels).not.toHaveBeenCalled()
  })

  it("移動（次の設問・次の生徒）とズームは止めない", async () => {
    await renderScoringKeys({ isCurrentQuestionPageMissing: true })

    pressKey("ArrowRight") // 次の設問
    pressKey("ArrowDown") // 次の生徒
    pressKey("=") // ズームイン
    await settle()

    expect(navigation.handleNextQuestion).toHaveBeenCalled()
    expect(navigation.handleIndividualNavigation).toHaveBeenCalled()
    expect(navigation.handleZoomIn).toHaveBeenCalled()
    expect(toast.info).not.toHaveBeenCalled()
  })

  it("ページがあれば、採点キーはこれまでどおり書く", async () => {
    await renderScoringKeys({ isCurrentQuestionPageMissing: false })

    pressKey("e")

    await waitFor(() =>
      expect(fakeApi.setQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          examStudentId: "exam-student-1",
          status: "correct",
        })
      )
    )
    expect(toast.info).not.toHaveBeenCalled()
  })
})
