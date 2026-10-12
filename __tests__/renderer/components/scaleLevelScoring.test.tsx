// @vitest-environment jsdom
/**
 * 07 の類型評価の設問の採点（docs/vlm-grading-design.md §4-8-5・§4-8-6）。
 *
 * ここで固定すること:
 * - 数字キーが並び順に類型を選び、選んでいる答案へ類型を書く（1 が先頭）。部分点の入力は始めない
 * - 正答・誤答・部分点のキーは効かない（書かない・次へ進まない）。保留のキーは効く
 * - 点の採点の設問では、数字キーはこれまでどおり部分点の入力を始め、正答のキーも効く
 * - 採点パネルは、部分点の欄と正答・誤答・部分点のボタンの代わりに類型のボタンを並べる
 * - 類型の組が選ばれていなければ知らせる
 * - 一覧のマスは類型の記号と点数を類型の色で出し、方式と合わない採点は未採点と同じに見せる
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import type { ScaleQuestionState } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import { SCALE_LEVEL_PALETTE } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import { GridCell } from "@/components/exams/07-score-at-once/ScoringGrid/GridCell"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useGuardedScoring } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGuardedScoring"
import { useScoringShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import ScoringToolbar from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringToolbar"
import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import { DEFAULT_SCORING_STATUS_COLORS } from "@/lib/scoringStatusColors"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"
import { DEFAULT_CLICK_SCORING_CONFIG } from "@/types/clickScoring.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
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

function makeCropRegion(
  scoringMethod: string,
  scoreScaleId: string | null
): QuestionAnswerRegionRow {
  return {
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
    scoringMethod,
    scoreScaleId,
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

/** 採点画面の Provider（取得・利用者・キー）に載せて描く。QueryClient はテストごとに新しくする */
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
const setSelectedAnswers = vi.fn()

/**
 * 07 の採点の口（`useGuardedScoring`）と採点キー（`useScoringShortcuts`）だけを載せた見本。
 * 1つの答案を選んだ一覧表示として動かす
 */
function ScoringKeys({
  cropRegion,
  scale,
}: {
  cropRegion: QuestionAnswerRegionRow
  scale: ScaleQuestionState
}) {
  useContextValue("hasSelectedAnswers", true)
  const scoring = useGuardedScoring({
    scoringData: {
      examId: "exam-1",
      currentUserId: CURRENT_USER_ID,
      currentCropRegionId: cropRegion.id,
      studentAnswerImages: [answerImage],
      cropRegions: [cropRegion],
      questionScoresByCropRegionId: new Map(),
    },
    progress: {
      selectedAnswers,
      gradingMode: "grid",
      scoringBehavior: "next-student",
      setRecentlyScoredAnswers: noop,
      getGridAnswerData: () => [],
      setSelectedAnswers,
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
    currentCropRegion: cropRegion,
    scaleQuestion: scale,
    isCurrentQuestionPageMissing: false,
  })
  useScoringShortcuts({
    handleToggleStudentNames: noop,
    handleRefreshFilter: noop,
    handleNextQuestion: noop,
    handlePrevQuestion: noop,
    handleGridNavigation: noop,
    handleIndividualNavigation: noop,
    handleZoomIn: noop,
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

async function renderScoringKeys(
  cropRegion: QuestionAnswerRegionRow,
  scale: ScaleQuestionState
) {
  renderWithProviders(<ScoringKeys cropRegion={cropRegion} scale={scale} />)
  // キー割当の取得とコマンド登録・コンテキスト反映の effect を落ち着かせる
  await act(async () => {
    await Promise.resolve()
  })
}

function pressKey(key: string) {
  fireEvent.keyDown(document.body, { key })
}

describe("類型評価の設問の採点キー", () => {
  it("数字キーが並び順に類型を選び、選んでいる答案へ書く（部分点の入力は始めない）", async () => {
    await renderScoringKeys(makeCropRegion("scale", "scale-1"), scaleQuestion)

    pressKey("2")

    await waitFor(() =>
      expect(fakeApi.setScaleLevels).toHaveBeenCalledWith({
        cropRegionId: CROP_REGION_ID,
        examStudentIds: ["exam-student-1"],
        scaleLevelId: "level-b",
      })
    )
    expect(screen.getByTestId("partial-input")).toHaveTextContent("")
    // 書いたあとは採点キーと同じ進み方をする（一覧の並びが空なので選択は動かさない）
    expect(fakeApi.setQuestionScore).not.toHaveBeenCalled()
  })

  it("類型の数を超える数字・0 は何もしない", async () => {
    await renderScoringKeys(makeCropRegion("scale", "scale-1"), scaleQuestion)

    pressKey("4")
    pressKey("0")

    expect(fakeApi.setScaleLevels).not.toHaveBeenCalled()
    expect(screen.getByTestId("partial-input")).toHaveTextContent("")
  })

  it("正答・誤答・部分点のキーは書かない", async () => {
    await renderScoringKeys(makeCropRegion("scale", "scale-1"), scaleQuestion)

    pressKey("e") // 正答
    pressKey("o") // 誤答
    pressKey("f") // 部分点

    await act(async () => {
      await Promise.resolve()
    })
    expect(fakeApi.setQuestionScore).not.toHaveBeenCalled()
    expect(fakeApi.updateQuestionScore).not.toHaveBeenCalled()
    expect(fakeApi.setScaleLevels).not.toHaveBeenCalled()
  })

  it("保留のキーは効く（点の採点と同じ口で書く）", async () => {
    await renderScoringKeys(makeCropRegion("scale", "scale-1"), scaleQuestion)

    pressKey("j")

    await waitFor(() =>
      expect(fakeApi.setQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          examStudentId: "exam-student-1",
          status: "pending",
        })
      )
    )
  })

  it("点の採点の設問では、数字キーは部分点の入力を始め、正答のキーも効く", async () => {
    await renderScoringKeys(makeCropRegion("points", null), notScaleQuestion)

    pressKey("e")
    await waitFor(() =>
      expect(fakeApi.setQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({ status: "correct" })
      )
    )

    pressKey("2")
    await waitFor(() =>
      expect(screen.getByTestId("partial-input")).toHaveTextContent("入力中:2")
    )
    expect(fakeApi.setScaleLevels).not.toHaveBeenCalled()
  })
})

function renderToolbar(scale: ScaleQuestionState) {
  const onApplyScaleLevel = vi.fn()
  const onScore = vi.fn()
  renderWithProviders(
    <ScoringToolbar
        selectedAnswersCount={1}
        onScore={onScore}
        onOpenPartialScoreModal={noop}
        partialScoreInput=""
        scaleQuestion={scale}
        onApplyScaleLevel={onApplyScaleLevel}
      />
  )
  return { onApplyScaleLevel, onScore }
}

describe("類型評価の設問の採点パネル", () => {
  it("部分点の欄と正答・誤答・部分点のボタンの代わりに、類型のボタンを並び順に並べる", async () => {
    const { onApplyScaleLevel, onScore } = renderToolbar(scaleQuestion)

    const group = screen.getByRole("group", { name: "類型" })
    const levelButtons = within(group).getAllByRole("button")
    expect(levelButtons).toHaveLength(3)
    expect(levelButtons[0]).toHaveTextContent("A")
    expect(levelButtons[0]).toHaveTextContent("10点")
    expect(levelButtons[0]).toHaveTextContent("根拠を2つ以上挙げている")
    expect(levelButtons[1]).toHaveTextContent("B")

    expect(
      screen.queryByRole("button", { name: /部分点入力/ })
    ).not.toBeInTheDocument()
    for (const label of ["正答", "誤答", "部分点"]) {
      expect(
        screen.queryByRole("button", { name: label })
      ).not.toBeInTheDocument()
    }
    // 保留・無答・Wマーク・未採点は残る
    for (const label of ["未採点", "保留", "無答", "Wマーク"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }

    await userEvent.click(levelButtons[1])
    expect(onApplyScaleLevel).toHaveBeenCalledWith("level-b")

    await userEvent.click(screen.getByRole("button", { name: "保留" }))
    expect(onScore).toHaveBeenCalledWith("pending")
  })

  it("類型の組が選ばれていなければ知らせ、類型のボタンは出さない", () => {
    renderToolbar({
      isScaleQuestion: true,
      scaleLevels: [],
      isScaleLevelsLoading: false,
    })

    expect(
      screen.getByText(
        "この設問は類型方式ですが、類型表が選ばれていません。03 の領域設定で選んでください。"
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "類型" })
    ).not.toBeInTheDocument()
  })

  it("点の採点の設問では、これまでどおり正答・部分点のボタンと部分点の欄を出す", () => {
    renderToolbar(notScaleQuestion)

    expect(screen.queryByRole("group", { name: "類型" })).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /部分点入力/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "正答" })).toBeInTheDocument()
  })
})

function scoringData(status: ScoringStatus): ScoringData {
  return {
    id: "answer-1",
    examStudentId: "exam-student-1",
    studentName: "生徒 一",
    imageUrl: "appimg:///answers/1.png",
    maxScore: 10,
    status,
    questionRegion: makeCropRegion("scale", "scale-1"),
    customOrder: 0,
  }
}

function renderCell(
  status: ScoringStatus,
  scaleAppearance: Parameters<typeof GridCell>[0]["scaleAppearance"]
) {
  const { container } = render(
    <GridCell
      answer={scoringData(status)}
      isSelected={false}
      showStudentNames
      layoutDirection="right-down"
      calculatedCellHeight={0}
      selectionBorderColor="#2563eb"
      scoringColors={DEFAULT_SCORING_STATUS_COLORS}
      onMouseDown={noop}
      scaleAppearance={scaleAppearance}
    />
  )
  const cell = container.querySelector<HTMLElement>("[data-answer-id]")
  if (!cell) throw new Error("マスが描かれていません")
  return cell
}

describe("一覧のマスの類型", () => {
  it("類型を付けたマスは、類型の記号と点数を類型の色で出す", () => {
    const cell = renderCell("evaluated", {
      label: "B",
      score: 6,
      colors: SCALE_LEVEL_PALETTE[1],
    })

    expect(within(cell).getByText("B")).toBeInTheDocument()
    expect(within(cell).getByText("6/10")).toBeInTheDocument()
    // #FEF3C7（並び順2番目の色）
    expect(cell.style.backgroundColor).toBe("rgb(254, 243, 199)")
  })

  it("類型が消えた評価済みは、評価済みの既定の色で点を欠測にする", () => {
    const cell = renderCell("evaluated", null)

    expect(within(cell).getByText("-/10")).toBeInTheDocument()
    // 評価済みの既定の色（#F1F5F9）
    expect(cell.style.backgroundColor).toBe("rgb(241, 245, 249)")
  })
})
