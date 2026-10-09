// @vitest-environment jsdom
/**
 * 07 のルーブリックのパネルの、項目の助言から作る朱書きと重なった助言の問いかけ
 * （docs/vlm-grading-design.md §3-7・§4-7）。
 *
 * ここで固定すること:
 * - 項目を当てると、当てたマスの助言の朱書きを作る（印付きで、差分を main へ渡す）
 * - 助言のある項目が2つ当たった答案の組み合わせは「未決定」としてパネルに出る
 * - 選択の場面で、項目の続きの番号で未決定の組み合わせを開き、数字で選ぶと下見の朱書きが
 *   変わり、Enter で決まりを保存してその組み合わせの答案の朱書きを作る。Esc で項目へ戻る
 * - まとめた一文は 0 で書き始め、入力欄の Enter で決める
 * - 決めた決まりは開き直して「未決定に戻す」ことができ、朱書きを外す
 *
 * window.electronAPI は偽物で、実データには触れない。一覧の部品は下見の朱書きの文だけを描く偽物。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { RubricPanel } from "@/components/exams/07-score-at-once/Rubric/RubricPanel"
import type AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { RubricItemRow } from "@/queries/rubric"
import type { PublicUser } from "@/queries/user"

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

/** 一覧の部品の代わり。答案ごとに、下見の朱書きの文を描く */
vi.mock(
  "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView",
  () => ({
    default: ({
      allScoringData,
      previewRubricAdviceOf,
    }: ComponentProps<typeof AnswerGridView>) => (
      <div data-testid="fake-answer-grid">
        {allScoringData.map((scoringData) => (
          <p key={scoringData.id} data-testid="preview-advice">
            {(previewRubricAdviceOf?.(scoringData) ?? [])
              .map((drawingAnnotation) => drawingAnnotation.text)
              .join("|") || "（朱書きなし）"}
          </p>
        ))}
      </div>
    ),
  })
)

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
  scoringMethod: "deduction",
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
  adviceText: "単位を書こう",
  sortOrder: 0,
})
const signError = makeRubricItem({
  id: "item-sign",
  label: "符号の誤り",
  adviceText: "移項の符号を見直そう",
  sortOrder: 1,
})

/** 自分の採点行（s1）に2つの項目が当たっている */
const ownRow = makeQuestionScore({
  id: "score-s1",
  examStudentId: "s1",
  status: "partial",
  partialScore: 2,
})
const applicationsOfOwnRow = [unitMissing, signError].map((rubricItem) => ({
  id: `application-${rubricItem.id}`,
  questionScoreId: ownRow.id,
  rubricItemId: rubricItem.id,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}))

const scoringDataOfS1: ScoringData = {
  id: "answer-image-s1",
  examStudentId: "s1",
  studentName: "生徒 s1",
  imageUrl: "appimg:///answers/s1.png",
  maxScore: 4,
  status: "partial",
  currentScore: 2,
  questionRegion: cropRegion,
  customOrder: 1,
}

function makeCombination(
  overrides: { mode: string; mergedText?: string } & Record<string, unknown>
) {
  return {
    id: "combination-1",
    cropRegionId: CROP_REGION_ID,
    mergedText: "",
    primaryRubricItemId: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    items: [unitMissing, signError].map((rubricItem) => ({
      id: `combination-item-${rubricItem.id}`,
      combinationId: "combination-1",
      rubricItemId: rubricItem.id,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })),
    ...overrides,
  }
}

/** 朱書きを作り直す材料（自分の行と、決まり） */
function makeAdviceSource(
  combinations: ReturnType<typeof makeCombination>[],
  drawingAnnotations: unknown[] = []
) {
  return {
    ...cropRegion,
    rubricItems: [unitMissing, signError],
    rubricAdviceCombinations: combinations,
    questionScores: [
      {
        ...ownRow,
        rubricApplications: applicationsOfOwnRow,
        drawingAnnotations,
      },
    ],
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
  listAdviceCombinations: vi.fn(),
  getAdviceSource: vi.fn(),
  syncAdviceAnnotations: vi.fn(),
  saveAdviceCombination: vi.fn(),
  deleteAdviceCombination: vi.fn(),
  measureInk: vi.fn(),
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

function RubricPanelHarness({
  selectedExamStudentIds = [],
}: {
  selectedExamStudentIds?: string[]
}) {
  useContextValue("hasSelectedAnswers", selectedExamStudentIds.length > 0)
  return (
    <RubricPanel
      examId="exam-1"
      cropRegion={cropRegion}
      currentUserId={CURRENT_USER_ID}
      questionScores={[ownRow]}
      selectedExamStudentIds={selectedExamStudentIds}
      onAdvance={vi.fn()}
      studentAnswerImages={[makeStudentAnswerImage("s1")]}
      scoringDatas={[scoringDataOfS1]}
      pageSize="A4"
    />
  )
}

function renderPanel(children: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>{children}</ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  installFakeElectronApi()
  fakeRubricApi.listItems.mockResolvedValue([unitMissing, signError])
  fakeRubricApi.listApplications.mockResolvedValue(applicationsOfOwnRow)
  fakeRubricApi.listAdviceCombinations.mockResolvedValue([])
  fakeRubricApi.getAdviceSource.mockResolvedValue(makeAdviceSource([]))
  fakeRubricApi.syncAdviceAnnotations.mockResolvedValue({
    createdCount: 1,
    updatedCount: 0,
    deletedCount: 0,
  })
  fakeRubricApi.measureInk.mockResolvedValue([])
  fakeRubricApi.writeScores.mockResolvedValue({
    writtenQuestionScoreIds: [],
    deletedQuestionScoreIds: [],
    skippedOverriddenIds: [],
  })
})

describe("項目を当てたときの朱書き", () => {
  it("当てたマスの助言の朱書きを、印を付けて作る", async () => {
    fakeRubricApi.listApplications.mockResolvedValue([])
    const singleApplication = applicationsOfOwnRow.slice(0, 1)
    fakeRubricApi.setApplications.mockResolvedValue([
      { ...ownRow, rubricApplications: singleApplication },
    ])
    fakeRubricApi.getAdviceSource.mockResolvedValue({
      ...makeAdviceSource([]),
      questionScores: [
        {
          ...ownRow,
          rubricApplications: singleApplication,
          drawingAnnotations: [],
        },
      ],
    })
    renderPanel(<RubricPanelHarness selectedExamStudentIds={["s1"]} />)

    await userEvent.click(
      await screen.findByRole("button", { name: "単位が無いを当てる・外す" })
    )
    await waitFor(() =>
      expect(fakeRubricApi.syncAdviceAnnotations).toHaveBeenCalledWith({
        cropRegionId: CROP_REGION_ID,
        creates: [
          {
            questionScoreId: "score-s1",
            annotation: expect.objectContaining({
              type: "text",
              text: "単位を書こう",
              isRubricAdvice: true,
              anchorDirection: "top-left",
            }),
          },
        ],
        updates: [],
        deletes: [],
      })
    )
  })
})

describe("重なった助言の問いかけ", () => {
  it("未決定の組み合わせを番号で開き、数字で選ぶと下見が変わり、Enter で決めて朱書きを作る", async () => {
    const savedCombination = makeCombination({ mode: "all" })
    fakeRubricApi.saveAdviceCombination.mockResolvedValue(savedCombination)
    renderPanel(<RubricPanelHarness />)

    const adviceSection = await screen.findByRole("region", {
      name: "重なった助言",
    })
    expect(
      await within(adviceSection).findByText(/未決定・1件/)
    ).toBeInTheDocument()

    // 項目が2つなので、未決定の組み合わせは 3 番
    await userEvent.keyboard(" ")
    await userEvent.keyboard("3")
    const choiceView = await screen.findByLabelText("重なった助言の決まり")
    expect(
      within(choiceView).getByText("「単位が無い」の助言だけ")
    ).toBeInTheDocument()
    expect(within(choiceView).getByText("すべて並べる")).toBeInTheDocument()

    // 2: 「単位が無い」の助言だけ
    await userEvent.keyboard("2")
    await waitFor(() =>
      expect(screen.getByTestId("preview-advice")).toHaveTextContent(
        "単位を書こう"
      )
    )
    // 4: すべて並べる（段落を分けて並べる）
    await userEvent.keyboard("4")
    await waitFor(() =>
      expect(screen.getByTestId("preview-advice").textContent).toBe(
        "単位を書こう\n移項の符号を見直そう"
      )
    )

    fakeRubricApi.getAdviceSource.mockResolvedValue(
      makeAdviceSource([savedCombination])
    )
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(fakeRubricApi.saveAdviceCombination).toHaveBeenCalledWith({
        cropRegionId: CROP_REGION_ID,
        rubricItemIds: ["item-unit", "item-sign"],
        mode: "all",
        mergedText: "",
        primaryRubricItemId: null,
      })
    )
    await waitFor(() =>
      expect(fakeRubricApi.syncAdviceAnnotations).toHaveBeenCalledWith(
        expect.objectContaining({
          creates: [
            {
              questionScoreId: "score-s1",
              annotation: expect.objectContaining({
                text: "単位を書こう\n移項の符号を見直そう",
                isRubricAdvice: true,
              }),
            },
          ],
        })
      )
    )
    // 決めたら項目の一覧へ戻る（場面には残る）
    expect(await screen.findByText(/数字で当てる・外す/)).toBeInTheDocument()
    expect(screen.queryByLabelText("重なった助言の決まり")).toBeNull()
  })

  it("Esc で決めずに項目の一覧へ戻る", async () => {
    renderPanel(<RubricPanelHarness />)
    await screen.findByText(/未決定・1件/)
    await userEvent.keyboard(" ")
    await userEvent.keyboard("3")
    await screen.findByLabelText("重なった助言の決まり")
    await userEvent.keyboard("{Escape}")
    expect(await screen.findByText(/数字で当てる・外す/)).toBeInTheDocument()
    expect(screen.queryByLabelText("重なった助言の決まり")).toBeNull()
    expect(fakeRubricApi.saveAdviceCombination).not.toHaveBeenCalled()
  })

  it("0 でまとめた一文を書き、入力欄の Enter で決める（空なら決めない）", async () => {
    fakeRubricApi.saveAdviceCombination.mockResolvedValue(
      makeCombination({ mode: "merged", mergedText: "符号と単位を見直そう" })
    )
    renderPanel(<RubricPanelHarness />)
    await screen.findByText(/未決定・1件/)
    await userEvent.keyboard(" ")
    await userEvent.keyboard("3")
    await screen.findByLabelText("重なった助言の決まり")

    await userEvent.keyboard("0")
    const mergedInput = screen.getByRole("textbox", { name: "まとめた一文" })
    expect(mergedInput).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    expect(fakeRubricApi.saveAdviceCombination).not.toHaveBeenCalled()

    await userEvent.type(mergedInput, "符号と単位を見直そう")
    await waitFor(() =>
      expect(screen.getByTestId("preview-advice")).toHaveTextContent(
        "符号と単位を見直そう"
      )
    )
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(fakeRubricApi.saveAdviceCombination).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "merged",
          mergedText: "符号と単位を見直そう",
        })
      )
    )
  })

  it("決めた決まりは開き直して未決定に戻せ、その組み合わせの朱書きを外す", async () => {
    const decided = makeCombination({ mode: "all" })
    fakeRubricApi.listAdviceCombinations.mockResolvedValue([decided])
    fakeRubricApi.deleteAdviceCombination.mockResolvedValue(decided)
    renderPanel(<RubricPanelHarness />)

    const adviceSection = await screen.findByRole("region", {
      name: "重なった助言",
    })
    await userEvent.click(
      await within(adviceSection).findByText(/すべて並べる・1件/)
    )
    const choiceView = await screen.findByLabelText("重なった助言の決まり")
    // 今の決まり（すべて並べる）に焦点がある
    expect(
      within(choiceView).getByRole("button", { name: /すべて並べる/ })
    ).toHaveAttribute("aria-pressed", "true")

    fakeRubricApi.getAdviceSource.mockResolvedValue(
      makeAdviceSource(
        [],
        [
          {
            id: "advice-1",
            questionScoreId: ownRow.id,
            type: "text",
            x: 0.2,
            y: 0.2,
            text: "単位を書こう\n移項の符号を見直そう",
            isRubricAdvice: true,
          },
        ]
      )
    )
    await userEvent.click(
      within(choiceView).getByRole("button", { name: /未決定に戻す/ })
    )
    await waitFor(() =>
      expect(fakeRubricApi.deleteAdviceCombination).toHaveBeenCalledWith(
        "combination-1"
      )
    )
    await waitFor(() =>
      expect(fakeRubricApi.syncAdviceAnnotations).toHaveBeenCalledWith({
        cropRegionId: CROP_REGION_ID,
        creates: [],
        updates: [],
        deletes: ["advice-1"],
      })
    )
  })
})
