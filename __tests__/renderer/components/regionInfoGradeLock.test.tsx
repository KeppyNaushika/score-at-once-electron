// @vitest-environment jsdom
/**
 * 「3. 領域情報」の表の、成績算出のロック（`RegionDetailsTable`）の検査。
 *
 * 1. **成績算出が使う設問だけ、配点・種類がロックされる。** 小計で使われていれば
 *    その小計へ割り当てた設問だけが当たり、他の行は編集できる
 * 2. **ロックを押して「編集する」で確認すると、その行だけ解除される。**
 * 3. **解除は state だけ。** 表を作り直す（ページを開き直す）と再びロックされる
 */

import "../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import RegionDetailsTable from "@/components/exams/03-region-info/components/RegionDetailsTable"
import type { CropRegionRow } from "@/queries/cropRegion"
import type { GradeLockSource } from "@/types/gradeLock.types"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const EXAM_ID = "exam-1"
const EXAM_PAGE_ID = "exam-page-1"
const TIMESTAMP = new Date("2026-08-01T00:00:00.000Z")

function cropRegionRow(id: string, label: string): CropRegionRow {
  return {
    id,
    examPageId: EXAM_PAGE_ID,
    label,
    type: "QUESTION_ANSWER",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.1,
    points: 10,
    orderIndex: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    examPage: {
      id: EXAM_PAGE_ID,
      examId: EXAM_ID,
      pageNumber: 1,
      imagePath: "pages/1.png",
      pageSize: "A4",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    cropSubtotals: [],
  }
}

const REGION_A = cropRegionRow("region-a", "問1")
const REGION_B = cropRegionRow("region-b", "問2")

/** 問1 だけを割り当てた小計を、成績算出が使っている */
const SUBTOTAL_SOURCE: GradeLockSource = {
  gradeId: "grade-1",
  gradeName: "1学期成績",
  gradeItemName: "思考・判断・表現",
  dataSourceId: "data-source-1",
  dataSourceName: "大問1",
  dataSourceType: "subtotal",
  examId: EXAM_ID,
  cropRegionId: null,
  subtotalId: "subtotal-1",
  courseworkItemId: null,
  treatExpectedAsMissing: false,
  subtotalCropRegionIds: [REGION_A.id],
}

const updateCropRegion = vi.fn(async () => null)

beforeEach(() => {
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    value: {
      updateCropRegion,
      deleteCropRegion: vi.fn(async () => null),
      updateCropRegionOrders: vi.fn(async () => null),
      grade: {
        getExamLockSources: vi.fn(async () => [SUBTOTAL_SOURCE]),
      },
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
  vi.clearAllMocks()
})

function renderTable() {
  return render(
    <RegionDetailsTable
      examId={EXAM_ID}
      regions={[REGION_A, REGION_B]}
      selectedCropRegionId={null}
      onSelectCropRegion={() => undefined}
      getOmrConfig={() => null}
      onOmrSave={async () => true}
      onOmrDelete={async () => true}
    />,
    { wrapper: createQueryWrapper() }
  )
}

function pointsInputOf(cropRegionId: string): HTMLElement {
  const input = document.querySelector(
    `[data-row="${cropRegionId}"][data-field="points"]`
  )
  if (!(input instanceof HTMLElement)) {
    throw new Error(`配点欄が無い: ${cropRegionId}`)
  }
  return input
}

describe("領域情報テーブルの成績算出ロック", () => {
  it("成績算出が使う設問の行だけ、配点がロックされる", async () => {
    renderTable()

    await waitFor(() => expect(pointsInputOf(REGION_A.id)).toBeDisabled())
    expect(pointsInputOf(REGION_B.id)).toBeEnabled()
    // 種類と配点の2つの欄にマークが付く（使われていない行には付かない）
    expect(
      screen.getAllByRole("button", {
        name: "成績算出で使われているためロックしています",
      })
    ).toHaveLength(2)
  })

  it("確認して「編集する」を押すと、その行だけ解除される", async () => {
    const user = userEvent.setup()
    renderTable()
    await waitFor(() => expect(pointsInputOf(REGION_A.id)).toBeDisabled())

    await user.click(
      screen.getAllByRole("button", {
        name: "成績算出で使われているためロックしています",
      })[0]
    )
    // どの成績算出のどの項目で使われているかを見せる
    expect(
      screen.getByText(
        "・成績算出「1学期成績」の評価項目「思考・判断・表現」のデータソース「大問1」（小計）"
      )
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "編集する" }))

    expect(pointsInputOf(REGION_A.id)).toBeEnabled()
    expect(
      screen.queryByRole("button", {
        name: "成績算出で使われているためロックしています",
      })
    ).not.toBeInTheDocument()

    await user.clear(pointsInputOf(REGION_A.id))
    await user.type(pointsInputOf(REGION_A.id), "5")
    await waitFor(() =>
      expect(updateCropRegion).toHaveBeenLastCalledWith(REGION_A.id, {
        points: 5,
      })
    )
  })

  it("解除は覚えない。表を作り直すと再びロックされる", async () => {
    const user = userEvent.setup()
    const { unmount } = renderTable()
    await waitFor(() => expect(pointsInputOf(REGION_A.id)).toBeDisabled())
    await user.click(
      screen.getAllByRole("button", {
        name: "成績算出で使われているためロックしています",
      })[0]
    )
    await user.click(screen.getByRole("button", { name: "編集する" }))
    expect(pointsInputOf(REGION_A.id)).toBeEnabled()

    unmount()
    renderTable()

    await waitFor(() => expect(pointsInputOf(REGION_A.id)).toBeDisabled())
  })
})
