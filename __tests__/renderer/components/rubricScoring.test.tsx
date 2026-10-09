// @vitest-environment jsdom
/**
 * 07 のルーブリック採点の画面（docs/vlm-grading-design.md §4・§11）。
 *
 * ここで固定すること:
 * - 採点方式の切り替え。他の採点者の点が変わるときだけ件数を示して確認し、了承してから書く
 * - 直接採点（points）の設問では、左のパネルもマスの印も出さず、項目も読まない
 * - 項目を押すと、選んだ答案にまとめて当て（外し）、項目から計算した点を書く
 * - 手での上書きの印と、上書きを解除して項目の点へ戻す操作
 * - 項目の削除は、点の変わる件数を示していつも確認する。値の検証に通らなければ書かない
 * - 選択の場面: Space で入り、数字で当てる・Enter で次の答案・Esc で抜ける。
 *   場面の中では採点中のキー（数字の部分点）が止まり、抜ければまた効く
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import {
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { useRubricScreen } from "@/components/exams/07-score-at-once/Rubric/hooks/useRubricScreen"
import { RubricCellMark } from "@/components/exams/07-score-at-once/Rubric/RubricCellMark"
import { RubricPanel } from "@/components/exams/07-score-at-once/Rubric/RubricPanel"
import { ScoringMethodSection } from "@/components/exams/07-score-at-once/Rubric/ScoringMethodSection"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { usePartialScoreShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/usePartialScoreShortcuts"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { RubricItemRow } from "@/queries/rubric"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeQuestionScore,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")
const COLLEAGUE_ID = "user-colleague"

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

function makeCropRegion(scoringMethod: string): QuestionAnswerRegionRow {
  return {
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
    scoringMethod,
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

function makeRubricItem(
  overrides: Partial<RubricItemRow> & { id: string }
): RubricItemRow {
  return {
    cropRegionId: CROP_REGION_ID,
    label: "",
    effectKind: "adjust",
    pointDelta: -1,
    setStatus: null,
    setScore: null,
    adviceText: "",
    sortOrder: 0,
    createdByUserId: CURRENT_USER_ID,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    createdBy: null,
    ...overrides,
  }
}

const unitMissing = makeRubricItem({
  id: "item-unit",
  label: "単位が無い",
  pointDelta: -1,
  sortOrder: 0,
})
const processMissing = makeRubricItem({
  id: "item-process",
  label: "途中式が無い",
  pointDelta: -2,
  sortOrder: 1,
})

/** 採点行に、当たっている項目を同梱した形（main が付け外しのあとに返すもの） */
function withApplications(
  questionScore: QuestionScoreRow,
  rubricItemIds: string[]
) {
  return {
    ...questionScore,
    rubricApplications: rubricItemIds.map((rubricItemId) => ({
      id: `application-${questionScore.id}-${rubricItemId}`,
      questionScoreId: questionScore.id,
      rubricItemId,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })),
  }
}

const fakeRubricApi = {
  listItems: vi.fn(),
  listApplications: vi.fn(),
  setApplications: vi.fn(),
  writeScores: vi.fn(),
  getRecalculationSource: vi.fn(),
  setScoringMethod: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  listAdviceCombinations: vi.fn(async () => []),
  getAdviceSource: vi.fn(async () => null),
  syncAdviceAnnotations: vi.fn(),
  saveAdviceCombination: vi.fn(),
  deleteAdviceCombination: vi.fn(),
  measureInk: vi.fn(async () => []),
}

function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: { getUserKeyboardShortcuts: vi.fn(async () => ({})) },
      rubric: fakeRubricApi,
      getQuestionScoresByCropRegionId: vi.fn(async () => []),
    },
    writable: true,
    configurable: true,
  })
}

function renderWithProviders(children: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>{children}</ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

/** 採点中の数字キー（部分点の入力を始める）。選択の場面の中では呼ばれてはいけない */
const scoringScenePartialHandlers = {
  handlePartialScoreInput: vi.fn(),
  handlePartialScoreConfirmPartial: vi.fn(),
  handlePartialScoreConfirmPending: vi.fn(),
  handlePartialScoreCancel: vi.fn(),
  handlePartialScoreBackspace: vi.fn(),
}

/** 採点画面と同じく、採点中のキーも載せたうえでパネルを描く */
function RubricPanelHarness({
  questionScores,
  selectedExamStudentIds,
  onAdvance = vi.fn(),
}: {
  questionScores: QuestionScoreRow[]
  selectedExamStudentIds: string[]
  onAdvance?: () => void
}) {
  useContextValue("hasSelectedAnswers", selectedExamStudentIds.length > 0)
  usePartialScoreShortcuts(scoringScenePartialHandlers)
  return (
    <RubricPanel
      examId="exam-1"
      cropRegion={makeCropRegion("deduction")}
      currentUserId={CURRENT_USER_ID}
      questionScores={questionScores}
      selectedExamStudentIds={selectedExamStudentIds}
      onAdvance={onAdvance}
      studentAnswerImages={[]}
      scoringDatas={[]}
      pageSize="A4"
    />
  )
}

/** 他の採点者の行（項目の値を変えると点が変わる） */
const colleagueRow = {
  ...withApplications(
    makeQuestionScore({
      id: "score-colleague",
      examStudentId: "s9",
      userId: COLLEAGUE_ID,
      status: "partial",
      partialScore: 3,
    }),
    ["item-unit"]
  ),
  user: null,
}

describe("ルーブリック採点の画面", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeElectronApi()
    fakeRubricApi.listItems.mockResolvedValue([unitMissing, processMissing])
    fakeRubricApi.listApplications.mockResolvedValue([])
    fakeRubricApi.writeScores.mockResolvedValue({
      writtenQuestionScoreIds: [],
      deletedQuestionScoreIds: [],
      skippedOverriddenIds: [],
    })
    fakeRubricApi.setScoringMethod.mockResolvedValue({})
    fakeRubricApi.deleteItem.mockResolvedValue({})
    fakeRubricApi.updateItem.mockResolvedValue({})
    fakeRubricApi.getRecalculationSource.mockResolvedValue({
      ...makeCropRegion("deduction"),
      rubricItems: [unitMissing, processMissing],
      questionScores: [],
    })
  })

  describe("採点方式の切り替え", () => {
    it("点の変わる行が無ければ確認せずに方式を書く", async () => {
      fakeRubricApi.getRecalculationSource.mockResolvedValue({
        ...makeCropRegion("points"),
        rubricItems: [],
        questionScores: [],
      })
      renderWithProviders(
        <ScoringMethodSection
          examId="exam-1"
          cropRegion={makeCropRegion("points")}
          currentUserId={CURRENT_USER_ID}
          isOpen
          onToggle={vi.fn()}
        />
      )
      expect(screen.getByRole("button", { name: "直接採点" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      await userEvent.click(screen.getByRole("button", { name: "減点方式" }))
      await waitFor(() =>
        expect(fakeRubricApi.setScoringMethod).toHaveBeenCalledWith(
          CROP_REGION_ID,
          "deduction"
        )
      )
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(fakeRubricApi.writeScores).not.toHaveBeenCalled()
    })

    it("他の採点者の点が変わるなら件数を示して確認し、了承してから方式と点を書く", async () => {
      fakeRubricApi.getRecalculationSource.mockResolvedValue({
        ...makeCropRegion("deduction"),
        rubricItems: [unitMissing],
        questionScores: [colleagueRow],
      })
      renderWithProviders(
        <ScoringMethodSection
          examId="exam-1"
          cropRegion={makeCropRegion("deduction")}
          currentUserId={CURRENT_USER_ID}
          isOpen
          onToggle={vi.fn()}
        />
      )
      await userEvent.click(screen.getByRole("button", { name: "加点方式" }))
      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent("他の採点者 1名・1件")
      expect(fakeRubricApi.setScoringMethod).not.toHaveBeenCalled()

      await userEvent.click(
        within(dialog).getByRole("button", { name: "変える" })
      )
      await waitFor(() =>
        expect(fakeRubricApi.setScoringMethod).toHaveBeenCalledWith(
          CROP_REGION_ID,
          "addition"
        )
      )
      // 加点方式では 0 + (−1) を 0〜4 に収めて 0点＝誤答
      await waitFor(() =>
        expect(fakeRubricApi.writeScores).toHaveBeenCalledWith([
          {
            questionScoreId: "score-colleague",
            status: "incorrect",
            partialScore: null,
            clearsOverride: false,
          },
        ])
      )
    })
  })

  describe("直接採点（points）の設問", () => {
    it("左のパネルもマスの印も出さず、項目を読まない", () => {
      const QueryWrapper = createQueryWrapper()
      const { result } = renderHook(
        () =>
          useRubricScreen({
            examId: "exam-1",
            currentUserId: CURRENT_USER_ID,
            gradingMode: "grid",
            currentCropRegion: makeCropRegion("points"),
            questionScoresByCropRegionId: new Map(),
          }),
        { wrapper: QueryWrapper }
      )
      expect(result.current.rubricCropRegion).toBeNull()
      expect(result.current.renderRubricCellMark).toBeUndefined()
      expect(fakeRubricApi.listItems).not.toHaveBeenCalled()
      expect(fakeRubricApi.listApplications).not.toHaveBeenCalled()
    })

    it("減点方式の設問ではパネルと印を出す（AI採点モードでは出さない）", () => {
      const QueryWrapper = createQueryWrapper()
      const { result, rerender } = renderHook(
        ({ gradingMode }: { gradingMode: "grid" | "ai" }) =>
          useRubricScreen({
            examId: "exam-1",
            currentUserId: CURRENT_USER_ID,
            gradingMode,
            currentCropRegion: makeCropRegion("deduction"),
            questionScoresByCropRegionId: new Map(),
          }),
        { wrapper: QueryWrapper, initialProps: { gradingMode: "grid" } }
      )
      expect(result.current.rubricCropRegion?.id).toBe(CROP_REGION_ID)
      expect(result.current.renderRubricCellMark).toBeDefined()
      rerender({ gradingMode: "ai" })
      expect(result.current.rubricCropRegion).toBeNull()
    })
  })

  describe("手での適用", () => {
    it("項目を押すと選んだ答案にまとめて当て、項目から計算した点を書く", async () => {
      fakeRubricApi.setApplications.mockResolvedValue([
        withApplications(
          makeQuestionScore({
            id: "score-s1",
            examStudentId: "s1",
            status: "unscored",
          }),
          ["item-unit"]
        ),
        withApplications(
          makeQuestionScore({
            id: "score-s2",
            examStudentId: "s2",
            status: "unscored",
          }),
          ["item-unit"]
        ),
      ])
      renderWithProviders(
        <RubricPanelHarness
          questionScores={[]}
          selectedExamStudentIds={["s1", "s2"]}
        />
      )
      await userEvent.click(
        await screen.findByRole("button", { name: "単位が無いを当てる・外す" })
      )
      await waitFor(() =>
        expect(fakeRubricApi.setApplications).toHaveBeenCalledWith({
          cropRegionId: CROP_REGION_ID,
          rubricItemId: "item-unit",
          examStudentIds: ["s1", "s2"],
          applied: true,
        })
      )
      // 減点方式: 配点 4 + (−1) = 3点の部分点
      await waitFor(() =>
        expect(fakeRubricApi.writeScores).toHaveBeenCalledWith([
          {
            questionScoreId: "score-s1",
            status: "partial",
            partialScore: 3,
            clearsOverride: false,
          },
          {
            questionScoreId: "score-s2",
            status: "partial",
            partialScore: 3,
            clearsOverride: false,
          },
        ])
      )
    })

    it("選んだ全部に当たっている項目を押すと外す", async () => {
      const ownRow = makeQuestionScore({
        id: "score-s1",
        examStudentId: "s1",
        status: "partial",
        partialScore: 3,
      })
      fakeRubricApi.listApplications.mockResolvedValue(
        withApplications(ownRow, ["item-unit"]).rubricApplications
      )
      fakeRubricApi.setApplications.mockResolvedValue([
        withApplications(ownRow, []),
      ])
      renderWithProviders(
        <RubricPanelHarness
          questionScores={[ownRow]}
          selectedExamStudentIds={["s1"]}
        />
      )
      const itemButton = await screen.findByRole("button", {
        name: "単位が無いを当てる・外す",
      })
      await waitFor(() =>
        expect(itemButton).toHaveAttribute("aria-pressed", "true")
      )
      await userEvent.click(itemButton)
      await waitFor(() =>
        expect(fakeRubricApi.setApplications).toHaveBeenCalledWith(
          expect.objectContaining({ rubricItemId: "item-unit", applied: false })
        )
      )
      // 適用が無くなった答案は未採点に戻す
      await waitFor(() =>
        expect(fakeRubricApi.writeScores).toHaveBeenCalledWith([
          {
            questionScoreId: "score-s1",
            status: "unscored",
            partialScore: null,
            clearsOverride: false,
          },
        ])
      )
    })
  })

  describe("手での上書き", () => {
    it("上書きしている答案を示し、項目の点へ戻せる", async () => {
      const overriddenRow = makeQuestionScore({
        id: "score-s1",
        examStudentId: "s1",
        status: "correct",
        overridesRubric: true,
      })
      fakeRubricApi.listApplications.mockResolvedValue(
        withApplications(overriddenRow, ["item-unit", "item-process"])
          .rubricApplications
      )
      renderWithProviders(
        <RubricPanelHarness
          questionScores={[overriddenRow]}
          selectedExamStudentIds={["s1"]}
        />
      )
      expect(
        await screen.findByText(
          /1件は採点キーで付けた点が項目より優先しています/
        )
      ).toBeInTheDocument()
      await userEvent.click(
        screen.getByRole("button", { name: /項目の点に戻す/ })
      )
      // 4 − 1 − 2 = 1点
      await waitFor(() =>
        expect(fakeRubricApi.writeScores).toHaveBeenCalledWith([
          {
            questionScoreId: "score-s1",
            status: "partial",
            partialScore: 1,
            clearsOverride: true,
          },
        ])
      )
    })

    it("マスの印は、当たっている項目の数と上書きを示す", () => {
      render(
        <RubricCellMark
          cell={{
            questionScore: undefined,
            appliedItemIds: new Set(["item-unit", "item-process"]),
            overridesRubric: true,
          }}
        />
      )
      expect(screen.getByLabelText("項目2つ")).toHaveTextContent("2")
      expect(screen.getByLabelText("手での上書き")).toBeInTheDocument()
    })
  })

  describe("項目の編集", () => {
    it("削除は点の変わる件数を示していつも確認し、了承してから消して点を書き直す", async () => {
      fakeRubricApi.getRecalculationSource.mockResolvedValue({
        ...makeCropRegion("deduction"),
        rubricItems: [unitMissing, processMissing],
        questionScores: [colleagueRow],
      })
      renderWithProviders(
        <RubricPanelHarness questionScores={[]} selectedExamStudentIds={[]} />
      )
      const entry = (await screen.findByText("単位が無い")).closest("li")
      if (!entry) throw new Error("項目の行が見つかりません")
      await userEvent.click(within(entry).getByRole("button", { name: "削除" }))
      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent("他の採点者 1名・1件")
      expect(fakeRubricApi.deleteItem).not.toHaveBeenCalled()

      await userEvent.click(
        within(dialog).getByRole("button", { name: "削除する" })
      )
      await waitFor(() =>
        expect(fakeRubricApi.deleteItem).toHaveBeenCalledWith("item-unit")
      )
      await waitFor(() =>
        expect(fakeRubricApi.writeScores).toHaveBeenCalledWith([
          {
            questionScoreId: "score-colleague",
            status: "unscored",
            partialScore: null,
            clearsOverride: false,
          },
        ])
      )
    })

    it("検証に通らない値はトーストで知らせて書かない", async () => {
      renderWithProviders(
        <RubricPanelHarness questionScores={[]} selectedExamStudentIds={[]} />
      )
      const entry = (await screen.findByText("単位が無い")).closest("li")
      if (!entry) throw new Error("項目の行が見つかりません")
      await userEvent.click(within(entry).getByRole("button", { name: "変更" }))
      const pointDelta = await screen.findByLabelText("加減する点")
      await userEvent.clear(pointDelta)
      await userEvent.type(pointDelta, "0")
      await userEvent.click(screen.getByRole("button", { name: "保存" }))
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "加減する点に 0 は指定できません"
        )
      )
      expect(fakeRubricApi.updateItem).not.toHaveBeenCalled()
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
  })

  describe("選択の場面のキー", () => {
    it("Space で入り、数字で当て、Enter で次の答案へ、Esc で抜ける", async () => {
      fakeRubricApi.setApplications.mockResolvedValue([])
      const onAdvance = vi.fn()
      renderWithProviders(
        <RubricPanelHarness
          questionScores={[]}
          selectedExamStudentIds={["s1"]}
          onAdvance={onAdvance}
        />
      )
      await screen.findByText("単位が無い")

      await userEvent.keyboard(" ")
      expect(await screen.findByText(/数字で当てる・外す/)).toBeInTheDocument()

      await userEvent.keyboard("2")
      await waitFor(() =>
        expect(fakeRubricApi.setApplications).toHaveBeenCalledWith(
          expect.objectContaining({
            rubricItemId: "item-process",
            examStudentIds: ["s1"],
            applied: true,
          })
        )
      )
      // 場面の中では、数字は部分点の入力を始めない
      expect(
        scoringScenePartialHandlers.handlePartialScoreInput
      ).not.toHaveBeenCalled()

      await userEvent.keyboard("{Enter}")
      expect(onAdvance).toHaveBeenCalledTimes(1)

      await userEvent.keyboard("{Escape}")
      await screen.findByText(/Space で選択の場面に入り/)

      // 抜けたら、数字はまた部分点の入力を始める
      await userEvent.keyboard("1")
      expect(
        scoringScenePartialHandlers.handlePartialScoreInput
      ).toHaveBeenCalledWith("1")
      expect(fakeRubricApi.setApplications).toHaveBeenCalledTimes(1)
    })

    it("↑↓ で焦点を移し、0 で項目の追加を開く", async () => {
      renderWithProviders(
        <RubricPanelHarness
          questionScores={[]}
          selectedExamStudentIds={["s1"]}
        />
      )
      await screen.findByText("単位が無い")
      await userEvent.keyboard(" ")
      await userEvent.keyboard("{ArrowDown}")
      const processEntry = screen.getByText("途中式が無い").closest("li")
      expect(processEntry?.className).toContain("ring-2")

      await userEvent.keyboard("0")
      expect(
        await screen.findByRole("dialog", { name: "ルーブリック項目を追加" })
      ).toBeInTheDocument()
    })
  })
})
