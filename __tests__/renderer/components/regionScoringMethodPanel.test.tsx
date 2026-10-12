// @vitest-environment jsdom
/**
 * 03 の設問の行を開いた中の、採点方式と類型評価（docs/vlm-grading-design.md §4-8-3a・§4-8-8）。
 *
 * ここで固定すること:
 * - 類型評価をまたぐ切り替えは、方式と合わなくなる採点（全採点者）の件数を示して確かめてから書く。
 *   0件ならそのまま書く。採点の行には書かない（点の計算し直しの材料も読まない）
 * - 点の採点どうしの切り替えは、07 と同じく点の計算し直しの材料を読んでから書く
 * - 類型評価で類型評価が無ければ知らせる。「新しく作る」はこの試験に作って、この設問に選ぶ
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScoringMethodInlinePanel } from "@/components/exams/03-region-info/components/ScoringMethodInlinePanel"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")

const currentUser: PublicUser = {
  id: "user-1",
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const fakeApi = {
  getQuestionScoresByCropRegionId: vi.fn(),
  rubric: {
    setScoringMethod: vi.fn(async () => ({})),
    getRecalculationSource: vi.fn(async () => null),
    writeScores: vi.fn(),
    listScoreScales: vi.fn(async () => []),
    createScoreScale: vi.fn(async () => ({ id: "scale-new" })),
    setCropRegionScoreScale: vi.fn(async () => ({})),
  },
}

function renderPanel(scoringMethod: string) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ScoringMethodInlinePanel
          examId="exam-1"
          cropRegion={{
            id: "q1",
            label: "問1",
            points: 10,
            scoringMethod,
            scoreScaleId: null,
          }}
        />
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

const scoredRows = (...statuses: string[]) =>
  statuses.map((status, index) => ({
    id: `score-${index}`,
    cropRegionId: "q1",
    examStudentId: `exam-student-${index}`,
    userId: index % 2 === 0 ? "user-1" : "user-2",
    status,
    partialScore: null,
  }))

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, "electronAPI", {
    value: fakeApi,
    writable: true,
    configurable: true,
  })
})

describe("類型評価をまたぐ切り替え", () => {
  it("方式と合わなくなる採点があれば、件数を示して確かめてから書く", async () => {
    fakeApi.getQuestionScoresByCropRegionId.mockResolvedValue(
      scoredRows("correct", "partial", "pending", "no_answer", "incorrect")
    )
    renderPanel("points")
    await userEvent.click(screen.getByRole("button", { name: "類型評価" }))

    expect(
      await screen.findByText(/方式と合わない採点が 3件あります/)
    ).toBeInTheDocument()
    expect(fakeApi.rubric.setScoringMethod).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "変える" }))
    await waitFor(() =>
      expect(fakeApi.rubric.setScoringMethod).toHaveBeenCalledWith(
        "q1",
        "scale"
      )
    )
    // 点は書き換えない
    expect(fakeApi.rubric.getRecalculationSource).not.toHaveBeenCalled()
    expect(fakeApi.rubric.writeScores).not.toHaveBeenCalled()
  })

  it("やめれば書かない", async () => {
    fakeApi.getQuestionScoresByCropRegionId.mockResolvedValue(
      scoredRows("correct")
    )
    renderPanel("deduction")
    await userEvent.click(screen.getByRole("button", { name: "類型評価" }))
    await screen.findByText(/方式と合わない採点が 1件あります/)
    await userEvent.click(screen.getByRole("button", { name: "やめる" }))
    expect(fakeApi.rubric.setScoringMethod).not.toHaveBeenCalled()
  })

  it("方式と合わなくなる採点が無ければ、そのまま書く", async () => {
    fakeApi.getQuestionScoresByCropRegionId.mockResolvedValue(
      scoredRows("pending", "unscored")
    )
    renderPanel("points")
    await userEvent.click(screen.getByRole("button", { name: "類型評価" }))
    await waitFor(() =>
      expect(fakeApi.rubric.setScoringMethod).toHaveBeenCalledWith(
        "q1",
        "scale"
      )
    )
    expect(screen.queryByText(/方式と合わない採点/)).not.toBeInTheDocument()
  })

  it("類型評価から点の採点へは、評価済みの採点を数える", async () => {
    fakeApi.getQuestionScoresByCropRegionId.mockResolvedValue(
      scoredRows("evaluated", "evaluated", "correct")
    )
    renderPanel("scale")
    await userEvent.click(screen.getByRole("button", { name: "直接採点" }))
    expect(
      await screen.findByText(/方式と合わない採点が 2件あります/)
    ).toBeInTheDocument()
  })
})

describe("点の採点どうしの切り替え", () => {
  it("07 と同じく、点の計算し直しの材料を読んでから書く", async () => {
    renderPanel("points")
    await userEvent.click(screen.getByRole("button", { name: "減点方式" }))
    await waitFor(() =>
      expect(fakeApi.rubric.setScoringMethod).toHaveBeenCalledWith(
        "q1",
        "deduction"
      )
    )
    expect(fakeApi.rubric.getRecalculationSource).toHaveBeenCalledWith("q1")
    expect(fakeApi.getQuestionScoresByCropRegionId).not.toHaveBeenCalled()
  })
})

describe("類型評価で使う類型の組", () => {
  it("類型評価が無ければ知らせ、「新しく作る」でこの試験に作ってこの設問に選ぶ", async () => {
    renderPanel("scale")
    expect(
      screen.getByText(/類型評価を選んでいないので/)
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "新しく作る" }))
    await waitFor(() =>
      expect(fakeApi.rubric.createScoreScale).toHaveBeenCalledWith({
        examId: "exam-1",
        name: "類型評価",
        // 配点 10点から決めた類型
        levels: [
          { label: "A", score: 10 },
          { label: "B", score: 6 },
          { label: "C", score: 3 },
        ],
      })
    )
    await waitFor(() =>
      expect(fakeApi.rubric.setCropRegionScoreScale).toHaveBeenCalledWith(
        "q1",
        "scale-new"
      )
    )
  })
})
