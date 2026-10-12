// @vitest-environment jsdom
/**
 * 03 で配点を変えたときの、ルーブリックの点の計算し直し（docs/vlm-grading-design.md §4-4・§4-6）。
 *
 * ここで固定すること:
 * - 配点はどの方式の設問でも1打鍵ごとに即座に書く。直接採点（points）の設問は計算し直しの材料を読まない
 * - 減点・加点方式の設問は、打鍵ごとにその打鍵の配点で全採点者の点を計算し直して書く。確認はしない。
 *   手での上書きの行は飛ばす
 * - 数にできない文字は書かない。空欄は、直接採点なら未設定（null）として書き、減点・加点方式では書かない
 * - 速い打鍵の競り合い: 古い打鍵の点の書き込みが新しい打鍵の分より後に着地しない。
 *   待っている間に新しい打鍵が来た分は書かない
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import RegionDetailsTable from "@/components/exams/03-region-info/components/RegionDetailsTable"
import { useRegionPointsRecalculation } from "@/components/exams/03-region-info/hooks/useRegionPointsRecalculation"
import {
  planPointsRecalculation,
  readPointsInput,
  recalculatesRubricScores,
} from "@/components/exams/03-region-info/utils/regionPoints"
import type {
  RubricScoredRow,
  RubricScoringItem,
} from "@/components/exams/07-score-at-once/Rubric/types"
import type { CropRegionRow } from "@/queries/cropRegion"

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

function makeCropRegion(scoringMethod: string): CropRegionRow {
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
    scoreScaleId: null,
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

const unitMissing: RubricScoringItem = {
  id: "item-unit",
  effectKind: "adjust",
  pointDelta: -1,
  setStatus: null,
  setScore: null,
  setScaleLevelId: null,
  sortOrder: 0,
  createdAt: FIXED_DATE,
}

/** 計算し直しの材料の採点行（main が適用と採点者を同梱して返す形） */
function recalculationRow(
  overrides: Parameters<typeof makeQuestionScore>[0],
  rubricItemIds: string[]
) {
  const questionScore = makeQuestionScore(overrides)
  return {
    ...questionScore,
    rubricApplications: rubricItemIds.map((rubricItemId) => ({
      id: `application-${questionScore.id}-${rubricItemId}`,
      questionScoreId: questionScore.id,
      rubricItemId,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })),
    user: null,
  }
}

/** 4点満点で単位の減点（−1）が当たっている、自分の行（保存は 3点） */
const ownRow = recalculationRow(
  { examStudentId: "s1", status: "partial", partialScore: 3 },
  ["item-unit"]
)
/** 同じく他の採点者の行 */
const colleagueRow = recalculationRow(
  {
    id: "score-colleague",
    examStudentId: "s9",
    userId: COLLEAGUE_ID,
    status: "partial",
    partialScore: 3,
  },
  ["item-unit"]
)
/** 採点キーで上書きした自分の行（計算し直さない） */
const overriddenRow = recalculationRow(
  {
    examStudentId: "s2",
    status: "partial",
    partialScore: 1,
    overridesRubric: true,
  },
  ["item-unit"]
)

const deductionSource = {
  ...makeCropRegion("deduction"),
  rubricItems: [unitMissing],
  questionScores: [ownRow, colleagueRow, overriddenRow],
  scoreScale: null,
  scaleLevelIds: [],
}

/** 配点 `points` のとき、単位の減点だけが当たった行に書く点 */
const scoreWrite = (questionScoreId: string, points: number) => ({
  questionScoreId,
  status: "partial",
  partialScore: points - 1,
  scaleLevelId: null,
  clearsOverride: false,
})

const fakeApi = {
  updateCropRegion: vi.fn(),
  rubric: {
    getRecalculationSource: vi.fn(),
    writeScores: vi.fn(),
  },
}

function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: fakeApi,
    writable: true,
    configurable: true,
  })
}

function renderTable(cropRegion: CropRegionRow) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <RegionDetailsTable
        examId="exam-1"
        regions={[cropRegion]}
        selectedCropRegionId={null}
        onSelectCropRegion={vi.fn()}
        getOmrConfig={() => null}
        onOmrSave={vi.fn(async () => true)}
        onOmrDelete={vi.fn(async () => true)}
      />
    </QueryWrapper>
  )
}

const pointsInput = () => screen.getByPlaceholderText<HTMLInputElement>("10")

/** 外から解決できる約束（書き込み・読み込みの着地の順を決める） */
function deferred<Resolved>() {
  let resolve: (resolved: Resolved) => void = () => {}
  const promise = new Promise<Resolved>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const WRITE_RESULT = {
  writtenQuestionScoreIds: [],
  deletedQuestionScoreIds: [],
  skippedOverriddenIds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  installFakeElectronApi()
  fakeApi.updateCropRegion.mockResolvedValue({})
  fakeApi.rubric.writeScores.mockResolvedValue(WRITE_RESULT)
  fakeApi.rubric.getRecalculationSource.mockResolvedValue(deductionSource)
})

describe("配点の欄の読み取り", () => {
  it("数にできない文字は書かない。空欄は直接採点なら未設定、減点・加点方式では書かない", () => {
    expect(readPointsInput("8", "points")).toEqual({
      kind: "points",
      points: 8,
    })
    expect(readPointsInput("8", "deduction")).toEqual({
      kind: "points",
      points: 8,
    })
    expect(readPointsInput("-", "points")).toEqual({ kind: "incomplete" })
    expect(readPointsInput("", "points")).toEqual({
      kind: "points",
      points: null,
    })
    expect(readPointsInput("", "addition")).toEqual({ kind: "incomplete" })
  })

  it("点を計算し直すのは減点・加点方式の設問だけ", () => {
    expect(recalculatesRubricScores("points")).toBe(false)
    expect(recalculatesRubricScores("deduction")).toBe(true)
    expect(recalculatesRubricScores("addition")).toBe(true)
    // 外れ値は直接採点に倒す（項目から点を書き換えない側）
    expect(recalculatesRubricScores("unknown")).toBe(false)
  })
})

describe("planPointsRecalculation", () => {
  const source = {
    ...deductionSource,
    questionScores: [
      ownRow,
      colleagueRow,
      overriddenRow,
    ] satisfies RubricScoredRow[],
  }

  it("変えたあとの配点で全採点者の行を計算し、上書きの行を飛ばす", () => {
    expect(
      planPointsRecalculation(source, 6).map((change) => [
        change.questionScoreId,
        change.userId,
        change.after,
      ])
    ).toEqual([
      [
        ownRow.id,
        CURRENT_USER_ID,
        { status: "partial", partialScore: 5, scaleLevelId: null },
      ],
      [
        "score-colleague",
        COLLEAGUE_ID,
        { status: "partial", partialScore: 5, scaleLevelId: null },
      ],
    ])
  })

  it("配点が変わらない・直接採点の設問・設問が無いときは対象が無い", () => {
    expect(planPointsRecalculation(source, 4)).toEqual([])
    expect(
      planPointsRecalculation({ ...source, scoringMethod: "points" }, 6)
    ).toEqual([])
    expect(planPointsRecalculation(null, 6)).toEqual([])
  })
})

describe("03 の配点の変更", () => {
  it("直接採点の設問は1打鍵ごとに書き、計算し直しの材料を読まない", async () => {
    renderTable(makeCropRegion("points"))
    const input = pointsInput()
    await userEvent.clear(input)
    await userEvent.type(input, "5")
    await waitFor(() =>
      expect(fakeApi.updateCropRegion).toHaveBeenLastCalledWith(
        CROP_REGION_ID,
        { points: 5 }
      )
    )
    // 消したときは未設定として書く（これまでどおり）
    expect(fakeApi.updateCropRegion).toHaveBeenCalledWith(CROP_REGION_ID, {
      points: null,
    })
    expect(fakeApi.rubric.getRecalculationSource).not.toHaveBeenCalled()
    expect(fakeApi.rubric.writeScores).not.toHaveBeenCalled()
  })

  it("減点方式の設問は打鍵ごとに配点を書き、全採点者の点をその配点で書く（確認しない）", async () => {
    renderTable(makeCropRegion("deduction"))
    const input = pointsInput()
    await userEvent.clear(input)
    await userEvent.type(input, "6")

    await waitFor(() =>
      expect(fakeApi.rubric.writeScores).toHaveBeenLastCalledWith([
        scoreWrite(ownRow.id, 6),
        scoreWrite("score-colleague", 6),
      ])
    )
    // 消しただけ（空欄）では書かない
    expect(fakeApi.updateCropRegion).toHaveBeenCalledTimes(1)
    expect(fakeApi.updateCropRegion).toHaveBeenCalledWith(CROP_REGION_ID, {
      points: 6,
    })
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("続けて打っても、最後の打鍵の配点で点が書かれる", async () => {
    renderTable(makeCropRegion("deduction"))
    const input = pointsInput()
    await userEvent.clear(input)
    await userEvent.type(input, "10")

    await waitFor(() =>
      expect(fakeApi.updateCropRegion).toHaveBeenLastCalledWith(
        CROP_REGION_ID,
        { points: 10 }
      )
    )
    await waitFor(() =>
      expect(fakeApi.rubric.writeScores).toHaveBeenLastCalledWith([
        scoreWrite(ownRow.id, 10),
        scoreWrite("score-colleague", 10),
      ])
    )
  })

  it("配点を書けなかった打鍵では点を書かない", async () => {
    fakeApi.updateCropRegion.mockRejectedValue(new Error("locked"))
    renderTable(makeCropRegion("deduction"))
    const input = pointsInput()
    await userEvent.clear(input)
    await userEvent.type(input, "6")
    await waitFor(() => expect(fakeApi.updateCropRegion).toHaveBeenCalled())
    // 失敗した書き込みの後始末が済むのを待ってから確かめる
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fakeApi.rubric.getRecalculationSource).not.toHaveBeenCalled()
    expect(fakeApi.rubric.writeScores).not.toHaveBeenCalled()
  })
})

describe("速い打鍵の競り合い（useRegionPointsRecalculation）", () => {
  const renderRecalculation = () =>
    renderHook(() => useRegionPointsRecalculation("exam-1"), {
      wrapper: createQueryWrapper(),
    })

  it("前の打鍵の点を書き終えるまで次の打鍵の材料を読まない", async () => {
    const firstWrite = deferred<typeof WRITE_RESULT>()
    fakeApi.rubric.writeScores.mockReturnValueOnce(firstWrite.promise)
    const { result } = renderRecalculation()

    const firstDone = result.current.recalculateForPoints(
      CROP_REGION_ID,
      5,
      Promise.resolve()
    )
    await waitFor(() =>
      expect(fakeApi.rubric.writeScores).toHaveBeenCalledTimes(1)
    )
    // 1打鍵目の書き込みが着地していない間に、2打鍵目が来る
    const secondDone = result.current.recalculateForPoints(
      CROP_REGION_ID,
      6,
      Promise.resolve()
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fakeApi.rubric.getRecalculationSource).toHaveBeenCalledTimes(1)

    firstWrite.resolve(WRITE_RESULT)
    await Promise.all([firstDone, secondDone])
    expect(fakeApi.rubric.writeScores.mock.calls.map((call) => call[0])).toEqual(
      [
        [scoreWrite(ownRow.id, 5), scoreWrite("score-colleague", 5)],
        [scoreWrite(ownRow.id, 6), scoreWrite("score-colleague", 6)],
      ]
    )
  })

  it("材料を読んでいる間に新しい打鍵が来た分は書かず、新しい打鍵の配点だけを書く", async () => {
    const firstSource = deferred<typeof deductionSource>()
    fakeApi.rubric.getRecalculationSource.mockReturnValueOnce(
      firstSource.promise
    )
    const { result } = renderRecalculation()

    const firstDone = result.current.recalculateForPoints(
      CROP_REGION_ID,
      1,
      Promise.resolve()
    )
    await waitFor(() =>
      expect(fakeApi.rubric.getRecalculationSource).toHaveBeenCalledTimes(1)
    )
    const secondDone = result.current.recalculateForPoints(
      CROP_REGION_ID,
      10,
      Promise.resolve()
    )
    firstSource.resolve(deductionSource)
    await Promise.all([firstDone, secondDone])

    expect(fakeApi.rubric.writeScores).toHaveBeenCalledTimes(1)
    expect(fakeApi.rubric.writeScores).toHaveBeenCalledWith([
      scoreWrite(ownRow.id, 10),
      scoreWrite("score-colleague", 10),
    ])
  })

  it("列で待っている間に新しい打鍵が来た分は、材料も読まない", async () => {
    const firstPointsWrite = deferred<unknown>()
    const { result } = renderRecalculation()

    const firstDone = result.current.recalculateForPoints(
      CROP_REGION_ID,
      1,
      firstPointsWrite.promise
    )
    const secondDone = result.current.recalculateForPoints(
      CROP_REGION_ID,
      10,
      Promise.resolve()
    )
    firstPointsWrite.resolve({})
    await Promise.all([firstDone, secondDone])

    expect(fakeApi.rubric.getRecalculationSource).toHaveBeenCalledTimes(1)
    expect(fakeApi.rubric.writeScores).toHaveBeenCalledTimes(1)
    expect(fakeApi.rubric.writeScores).toHaveBeenCalledWith([
      scoreWrite(ownRow.id, 10),
      scoreWrite("score-colleague", 10),
    ])
  })
})
