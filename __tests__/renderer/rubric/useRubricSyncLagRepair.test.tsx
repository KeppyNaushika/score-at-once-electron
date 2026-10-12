// @vitest-environment jsdom
/**
 * 同期の遅れで食い違った自分の点の直し（docs/vlm-grading-design.md §4-6 の2段落目）。
 *
 * 開いている設問の材料を読んだら、自分の採点行だけを今の項目で計算し、食い違いを1回だけ書く。
 * 手での上書きの行と、他の採点者の行には触らない。
 */

import "../setup"

import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useRubricSyncLagRepair } from "@/components/exams/07-score-at-once/Rubric/hooks/useRubricSyncLagRepair"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const EXAM_ID = "exam-1"
const CROP_REGION_ID = "region-1"
const ME = "user-me"
const COLLEAGUE = "user-colleague"

const unitMissing = {
  id: "unit-missing",
  effectKind: "adjust",
  pointDelta: -2,
  setStatus: null,
  setScore: null,
  sortOrder: 0,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
}

interface StoredRow {
  id: string
  userId: string
  status: string
  partialScore: number | null
  overridesRubric: boolean
}

const appliedRow = (stored: StoredRow) => ({
  ...stored,
  rubricApplications: [{ rubricItemId: unitMissing.id }],
})

const sourceOf = (rows: StoredRow[]) => ({
  id: CROP_REGION_ID,
  scoringMethod: "deduction",
  points: 10,
  rubricItems: [unitMissing],
  questionScores: rows.map(appliedRow),
})

/** 項目からは 10 - 2 = 8 点（部分点） */
const OWN_STALE: StoredRow = {
  id: "own-stale",
  userId: ME,
  status: "correct",
  partialScore: null,
  overridesRubric: false,
}
const OWN_FRESH: StoredRow = {
  id: "own-fresh",
  userId: ME,
  status: "partial",
  partialScore: 8,
  overridesRubric: false,
}
const OWN_OVERRIDDEN: StoredRow = {
  id: "own-overridden",
  userId: ME,
  status: "correct",
  partialScore: null,
  overridesRubric: true,
}
const COLLEAGUE_STALE: StoredRow = {
  id: "colleague-stale",
  userId: COLLEAGUE,
  status: "correct",
  partialScore: null,
  overridesRubric: false,
}

interface WriteScoresResult {
  writtenQuestionScoreIds: string[]
  deletedQuestionScoreIds: string[]
  skippedOverriddenIds: string[]
}

function installRubricApi(initialRows: StoredRow[]) {
  let rows = initialRows
  const getRecalculationSource = vi.fn(async () => sourceOf(rows))
  const writeScores = vi.fn(
    async (
      writes: { questionScoreId: string; partialScore: number | null }[]
    ): Promise<WriteScoresResult> => {
      const writtenIds = writes.map((write) => write.questionScoreId)
      rows = rows.map((row) =>
        writtenIds.includes(row.id)
          ? { ...row, status: "partial", partialScore: 8 }
          : row
      )
      return {
        writtenQuestionScoreIds: writtenIds,
        deletedQuestionScoreIds: [],
        skippedOverriddenIds: [],
      }
    }
  )
  Object.defineProperty(window, "electronAPI", {
    value: { rubric: { getRecalculationSource, writeScores } },
    writable: true,
    configurable: true,
  })
  return { getRecalculationSource, writeScores }
}

const renderRepair = () =>
  renderHook(
    () =>
      useRubricSyncLagRepair({
        examId: EXAM_ID,
        cropRegionId: CROP_REGION_ID,
        currentUserId: ME,
      }),
    { wrapper: createQueryWrapper() }
  )

describe("useRubricSyncLagRepair", () => {
  it("自分の食い違った行だけを1回書き、上書きの行と他の採点者の行には触らない", async () => {
    const { getRecalculationSource, writeScores } = installRubricApi([
      OWN_STALE,
      OWN_FRESH,
      OWN_OVERRIDDEN,
      COLLEAGUE_STALE,
    ])
    renderRepair()

    await waitFor(() => expect(writeScores).toHaveBeenCalledTimes(1))
    expect(writeScores.mock.calls[0][0]).toEqual([
      {
        questionScoreId: OWN_STALE.id,
        status: "partial",
        partialScore: 8,
        clearsOverride: false,
      },
    ])
    // 書いたあとに材料を読み直し、食い違いが消えたので書き足さない
    await waitFor(() =>
      expect(getRecalculationSource).toHaveBeenCalledTimes(2)
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(writeScores).toHaveBeenCalledTimes(1)
  })

  it("食い違いが無ければ書かない", async () => {
    const { getRecalculationSource, writeScores } = installRubricApi([
      OWN_FRESH,
      OWN_OVERRIDDEN,
      COLLEAGUE_STALE,
    ])
    renderRepair()

    await waitFor(() => expect(getRecalculationSource).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(writeScores).not.toHaveBeenCalled()
  })

  it("書いても食い違いが残る（main が飛ばした）ときは、読み直しても同じ組を書き直さない", async () => {
    const { getRecalculationSource, writeScores } = installRubricApi([
      OWN_STALE,
    ])
    writeScores.mockImplementation(async (writes) => ({
      writtenQuestionScoreIds: [],
      deletedQuestionScoreIds: [],
      skippedOverriddenIds: writes.map((write) => write.questionScoreId),
    }))
    renderRepair()

    await waitFor(() => expect(writeScores).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(getRecalculationSource).toHaveBeenCalledTimes(2)
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(writeScores).toHaveBeenCalledTimes(1)
  })
})
