// @vitest-environment jsdom
/**
 * 類型評価（類型の組）の編集（docs/vlm-grading-design.md §4-8-3a）。
 *
 * ここで固定すること:
 * - 名前・記号・点数は1打鍵ごとに書く。点数は数にできない途中（空欄・`-`）を書かない
 * - 共通の組で使っている設問があるときだけ、点数を直す前に「N試験・M設問」を示して確かめる。
 *   「続けて直す」のあとは、その組について聞き直さない。記号の変更は確かめない
 * - 03 から開いたときは「この試験用に複製して直す」で、この試験の設問だけを付け替え、
 *   止めていた変更を複製の同じ位置の類型に当てる
 * - 「キャンセル」は書かず、打ちかけの点数を保存されている値へ戻す
 * - 使われている類型は消せない。並べ替えは全類型を振り直して書く
 * - 共通の組を試験に戻せないとき（ほかの試験も使う）はスイッチを止めて理由を示す
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScoreScaleEditor } from "@/components/score-scales/ScoreScaleEditor"
import type { ScoreScaleLevelRow, ScoreScaleRow } from "@/queries/scoreScale"

import { createQueryWrapper } from "../../helpers/queryWrapper"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")

function makeExam(examId: string): NonNullable<ScoreScaleRow["exam"]> {
  return {
    id: examId,
    examName: `試験 ${examId}`,
    referenceDate: null,
    description: null,
    markerCorrectionEnabled: false,
    anonymousScoringEnforced: false,
    subtotalMarkColorEnabled: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  }
}

function makeUsingCropRegion(
  cropRegionId: string,
  examId: string,
  scoreScaleId: string
): ScoreScaleRow["cropRegions"][number] {
  return {
    id: cropRegionId,
    examPageId: `page-${examId}`,
    label: cropRegionId,
    type: "QUESTION_ANSWER",
    x: 0,
    y: 0,
    width: 0.1,
    height: 0.1,
    points: 10,
    orderIndex: 0,
    scoringMethod: "scale",
    scoreScaleId,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    examPage: {
      id: `page-${examId}`,
      examId,
      pageNumber: 1,
      imagePath: null,
      pageSize: "A4",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      exam: makeExam(examId),
    },
  }
}

function makeLevel(
  levelId: string,
  label: string,
  score: number,
  sortOrder: number,
  questionScores: ScoreScaleLevelRow["questionScores"] = []
): ScoreScaleLevelRow {
  return {
    id: levelId,
    scaleId: "scale-1",
    label,
    description: "",
    score,
    sortOrder,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    questionScores,
    scoreDecisions: [],
    settingRubricItems: [],
  }
}

function makeScoreScale(overrides: Partial<ScoreScaleRow>): ScoreScaleRow {
  return {
    id: "scale-1",
    examId: "exam-1",
    name: "記述の3類型",
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    exam: makeExam("exam-1"),
    levels: [
      makeLevel("level-a", "A", 10, 0),
      makeLevel("level-b", "B", 6, 1),
      makeLevel("level-c", "C", 3, 2),
    ],
    cropRegions: [],
    ...overrides,
  }
}

/** 共通の組（試験1の設問2つが使う） */
const globalScaleUsedByOneExam = () =>
  makeScoreScale({
    examId: null,
    exam: null,
    cropRegions: [
      makeUsingCropRegion("q1", "exam-1", "scale-1"),
      makeUsingCropRegion("q2", "exam-1", "scale-1"),
    ],
  })

const fakeApi = {
  rubric: {
    updateScoreScale: vi.fn(async () => ({})),
    setScoreScaleExam: vi.fn(async () => ({})),
    duplicateScoreScale: vi.fn(async () =>
      makeScoreScale({
        id: "scale-dup",
        levels: [
          makeLevel("dup-a", "A", 10, 0),
          makeLevel("dup-b", "B", 6, 1),
          makeLevel("dup-c", "C", 3, 2),
        ],
      })
    ),
    deleteScoreScale: vi.fn(async () => undefined),
    createScoreScaleLevel: vi.fn(async () => ({})),
    updateScoreScaleLevel: vi.fn(async () => ({})),
    reorderScoreScaleLevels: vi.fn(async () => undefined),
    deleteScoreScaleLevel: vi.fn(async () => undefined),
  },
}

function renderEditor(
  scoreScale: ScoreScaleRow,
  contextExamId: string | null = null
) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <ScoreScaleEditor
        scoreScale={scoreScale}
        contextExamId={contextExamId}
        points={10}
      />
    </QueryWrapper>
  )
}

const scoreInputs = () => screen.getAllByLabelText<HTMLInputElement>("点数")

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, "electronAPI", {
    value: fakeApi,
    writable: true,
    configurable: true,
  })
})

describe("1打鍵ごとの書き込み", () => {
  it("名前は打鍵ごとに書く", async () => {
    renderEditor(makeScoreScale({}))
    await userEvent.type(screen.getByLabelText("類型表の名前"), "X")
    await waitFor(() =>
      expect(fakeApi.rubric.updateScoreScale).toHaveBeenCalledWith("scale-1", {
        name: "記述の3類型X",
      })
    )
  })

  it("点数は数にできる打鍵だけを書く（空欄・`-` は書かない）", async () => {
    renderEditor(makeScoreScale({}))
    const scoreB = scoreInputs()[1]
    await userEvent.clear(scoreB)
    await userEvent.type(scoreB, "-")
    expect(fakeApi.rubric.updateScoreScaleLevel).not.toHaveBeenCalled()
    expect(scoreB).toHaveValue("-")

    await userEvent.clear(scoreB)
    await userEvent.type(scoreB, "1.5")
    await waitFor(() =>
      expect(fakeApi.rubric.updateScoreScaleLevel).toHaveBeenLastCalledWith(
        "level-b",
        { score: 1.5 }
      )
    )
    // 試験の組は確かめない
    expect(
      screen.queryByText("共通の類型表を直しますか？")
    ).not.toBeInTheDocument()
  })

  it("配点を超える類型に注記を添える（超えてよいので書き込みは止めない）", () => {
    renderEditor(
      makeScoreScale({
        levels: [
          makeLevel("level-s", "S", 12, 0),
          makeLevel("level-a", "A", 10, 1),
        ],
      })
    )
    expect(screen.getAllByText("配点（10点）を超えています")).toHaveLength(1)
  })
})

describe("共通の組の点数・類型を直す前の確認", () => {
  it("使っている試験・設問の数を示し、「続けて直す」のあとは聞き直さない", async () => {
    renderEditor(globalScaleUsedByOneExam())
    await userEvent.type(scoreInputs()[0], "5")

    expect(
      await screen.findByText("共通の類型表を直しますか？")
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("alertdialog")).getByText(
        /1試験・2設問で使っています/
      )
    ).toBeInTheDocument()
    expect(fakeApi.rubric.updateScoreScaleLevel).not.toHaveBeenCalled()
    // 管理の画面から開いたので複製は選べない
    expect(
      screen.queryByRole("button", { name: "この試験用に複製して直す" })
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "続けて直す" }))
    await waitFor(() =>
      expect(fakeApi.rubric.updateScoreScaleLevel).toHaveBeenCalledWith(
        "level-a",
        { score: 105 }
      )
    )

    await userEvent.type(scoreInputs()[0], "0")
    await waitFor(() =>
      expect(fakeApi.rubric.updateScoreScaleLevel).toHaveBeenLastCalledWith(
        "level-a",
        { score: 1050 }
      )
    )
    expect(
      screen.queryByText("共通の類型表を直しますか？")
    ).not.toBeInTheDocument()
  })

  it("記号の変更は確かめずに書く", async () => {
    renderEditor(globalScaleUsedByOneExam())
    await userEvent.type(screen.getAllByLabelText("記号")[0], "+")
    await waitFor(() =>
      expect(fakeApi.rubric.updateScoreScaleLevel).toHaveBeenCalledWith(
        "level-a",
        { label: "A+" }
      )
    )
    expect(
      screen.queryByText("共通の類型表を直しますか？")
    ).not.toBeInTheDocument()
  })

  it("「キャンセル」は書かず、打ちかけの点数を戻す", async () => {
    renderEditor(globalScaleUsedByOneExam())
    await userEvent.type(scoreInputs()[1], "9")
    await screen.findByText("共通の類型表を直しますか？")
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }))

    await waitFor(() => expect(scoreInputs()[1]).toHaveValue("6"))
    expect(fakeApi.rubric.updateScoreScaleLevel).not.toHaveBeenCalled()
  })

  it("類型を足すのも確かめる", async () => {
    renderEditor(globalScaleUsedByOneExam())
    await userEvent.click(screen.getByRole("button", { name: "類型を追加" }))
    await screen.findByText("共通の類型表を直しますか？")
    expect(fakeApi.rubric.createScoreScaleLevel).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "続けて直す" }))
    await waitFor(() =>
      expect(fakeApi.rubric.createScoreScaleLevel).toHaveBeenCalledWith({
        scaleId: "scale-1",
        label: "",
        description: "",
        score: 0,
      })
    )
  })

  it("03 から: この試験の設問だけを複製へ付け替え、変更を複製の同じ位置の類型に当てる", async () => {
    const scoreScale = makeScoreScale({
      examId: null,
      exam: null,
      cropRegions: [
        makeUsingCropRegion("q1", "exam-1", "scale-1"),
        makeUsingCropRegion("q-other", "exam-2", "scale-1"),
      ],
    })
    renderEditor(scoreScale, "exam-1")
    await userEvent.type(scoreInputs()[1], "5")
    expect(
      within(await screen.findByRole("alertdialog")).getByText(
        /2試験・2設問で使っています/
      )
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: "この試験用に複製して直す" })
    )
    await waitFor(() =>
      expect(fakeApi.rubric.duplicateScoreScale).toHaveBeenCalledWith({
        scoreScaleId: "scale-1",
        examId: "exam-1",
        reassignCropRegionIds: ["q1"],
      })
    )
    await waitFor(() =>
      expect(fakeApi.rubric.updateScoreScaleLevel).toHaveBeenCalledWith(
        "dup-b",
        { score: 65 }
      )
    )
    expect(fakeApi.rubric.updateScoreScaleLevel).not.toHaveBeenCalledWith(
      "level-b",
      expect.anything()
    )
  })
})

describe("類型の削除・並べ替え", () => {
  it("使われている類型は消せず、件数を示す", () => {
    const usedLevel = makeLevel("level-a", "A", 1, 0, [
      {
        id: "score-1",
        cropRegionId: "q1",
        examStudentId: "exam-student-1",
        partialScore: null,
        status: "evaluated",
        comment: "",
        userId: "user-1",
        overridesRubric: false,
        scaleLevelId: "level-a",
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])
    renderEditor(
      makeScoreScale({ levels: [usedLevel, makeLevel("level-b", "B", 0.5, 1)] })
    )
    const deleteButtons = screen.getAllByRole("button", { name: "類型を削除" })
    expect(deleteButtons[0]).toBeDisabled()
    expect(deleteButtons[1]).toBeEnabled()
    expect(screen.getByText("1件で使用中")).toBeInTheDocument()
  })

  it("試験の組の類型は確かめずに消す", async () => {
    renderEditor(makeScoreScale({}))
    await userEvent.click(
      screen.getAllByRole("button", { name: "類型を削除" })[2]
    )
    await waitFor(() =>
      expect(fakeApi.rubric.deleteScoreScaleLevel).toHaveBeenCalledWith(
        "level-c"
      )
    )
  })

  it("下へ動かすと、全類型を振り直して書く", async () => {
    renderEditor(makeScoreScale({}))
    await userEvent.click(screen.getAllByRole("button", { name: "下へ" })[0])
    await waitFor(() =>
      expect(fakeApi.rubric.reorderScoreScaleLevels).toHaveBeenCalledWith(
        "scale-1",
        [
          { id: "level-b", sortOrder: 0 },
          { id: "level-a", sortOrder: 1 },
          { id: "level-c", sortOrder: 2 },
        ]
      )
    )
  })
})

describe("使える範囲と削除", () => {
  it("ほかの試験も使う共通の組は、試験に戻せない理由を示す", () => {
    renderEditor(
      makeScoreScale({
        examId: null,
        exam: null,
        cropRegions: [
          makeUsingCropRegion("q1", "exam-1", "scale-1"),
          makeUsingCropRegion("q2", "exam-2", "scale-1"),
        ],
      })
    )
    expect(screen.getByRole("switch")).toBeDisabled()
    expect(
      screen.getByText(/ほかの試験の設問も使っています/)
    ).toBeInTheDocument()
  })

  it("管理の画面から: 1つの試験だけが使う共通の組は、その試験へ戻す", async () => {
    renderEditor(globalScaleUsedByOneExam())
    await userEvent.click(screen.getByRole("switch"))
    await waitFor(() =>
      expect(fakeApi.rubric.setScoreScaleExam).toHaveBeenCalledWith(
        "scale-1",
        "exam-1"
      )
    )
  })

  it("使っている設問があれば組を消せない", () => {
    renderEditor(globalScaleUsedByOneExam())
    expect(
      screen.getByRole("button", { name: "類型表を削除" })
    ).toBeDisabled()
    expect(screen.getByText("2問の設問が使っています")).toBeInTheDocument()
  })

  it("使われていない組は確かめてから消す", async () => {
    renderEditor(makeScoreScale({}))
    await userEvent.click(
      screen.getByRole("button", { name: "類型表を削除" })
    )
    expect(fakeApi.rubric.deleteScoreScale).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "削除する" }))
    await waitFor(() =>
      expect(fakeApi.rubric.deleteScoreScale).toHaveBeenCalledWith("scale-1")
    )
  })
})
