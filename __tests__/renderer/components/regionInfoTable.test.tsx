// @vitest-environment jsdom
/**
 * 「3. 領域情報」の表（`RegionDetailsTable`）の検査。
 *
 * 見るのは**選択（ハイライト）が意図どおり点くこと**と、**この表が担当を持たない
 * こと**の3つ。
 *
 * 1. **入力欄を押したら、選択が点いたまま編集に入る。** 入力欄の `onFocus` が
 *    選択を点けた直後、同じマウス操作の click が `tr` まで上がって
 *    「選択済みだから外す」と判断され、点いてすぐ消えていた
 * 2. **取り直しで前の行が消えても、選択が別の領域へ移らない。** 選択を配列の
 *    添字で持っていた頃は、1打鍵ごとの取り直しで行が増減すると**黙って隣の
 *    領域を指した**
 * 3. **この表に担当列は無い。** 行ごとにドロップダウンを開く形だと設問30問 ×
 *    採点者3人で最大90回押すことになるので、担当は「採点担当」タブの
 *    設問 × 採点者の対応表へ移した（検査は `regionInfoAssignment.test.tsx`）
 */

import "../setup"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import RegionDetailsTable from "@/components/exams/03-region-info/components/RegionDetailsTable"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { CropRegionRow } from "@/queries/cropRegion"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const EXAM_ID = "exam-1"
const EXAM_PAGE_ID = "exam-page-1"
const TIMESTAMP = new Date("2026-08-01T00:00:00.000Z")

const CURRENT_USER = {
  id: "user-owner",
  username: "owner",
  name: "所有者",
  role: "teacher",
  passcodeType: "none",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
}

/** 表に渡す採点領域1件（DB から返る形をそのまま作る） */
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
const REGION_C = cropRegionRow("region-c", "問3")

/**
 * 03 のページと同じ配線。**選択は採点領域の id で持つ。**
 * 取り直しの結果は `regions` で外から差し替える（表は取得を持たない）。
 */
function RegionTableHarness({ regions }: { regions: CropRegionRow[] }) {
  const [selectedCropRegionId, setSelectedCropRegionId] = useState<
    string | null
  >(null)

  return (
    <CurrentUserProvider user={CURRENT_USER}>
      <output data-testid="selected">{selectedCropRegionId ?? "なし"}</output>
      <RegionDetailsTable
        examId={EXAM_ID}
        regions={regions}
        selectedCropRegionId={selectedCropRegionId}
        onSelectCropRegion={setSelectedCropRegionId}
        getOmrConfig={() => null}
        onOmrSave={async () => true}
        onOmrDelete={async () => true}
      />
    </CurrentUserProvider>
  )
}

beforeEach(() => {
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    // 選択の振る舞いだけを見るので、境界は「何か返す」以上のことをしない
    value: {
      updateCropRegion: vi.fn(async () => null),
      deleteCropRegion: vi.fn(async () => null),
      updateCropRegionOrders: vi.fn(async () => null),
      assignCropRegion: vi.fn(async () => null),
      unassignCropRegion: vi.fn(async () => null),
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
  vi.clearAllMocks()
})

/** その領域の行のラベル欄 */
function labelInputOf(cropRegionId: string): HTMLElement {
  const input = document.querySelector(
    `[data-row="${cropRegionId}"][data-field="label"]`
  )
  if (!(input instanceof HTMLElement)) {
    throw new Error(`ラベル欄が無い: ${cropRegionId}`)
  }
  return input
}

/** その領域の行そのもの（光っているかを見る） */
function rowOf(cropRegionId: string): HTMLElement {
  const row = labelInputOf(cropRegionId).closest("tr")
  if (!row) throw new Error(`行が無い: ${cropRegionId}`)
  return row
}

describe("領域情報テーブルの選択", () => {
  it("入力欄を押すと選択が点き、同じ操作で消えない", async () => {
    const user = userEvent.setup()
    render(<RegionTableHarness regions={[REGION_A, REGION_B]} />, {
      wrapper: createQueryWrapper(),
    })

    await user.click(labelInputOf(REGION_B.id))

    expect(screen.getByTestId("selected")).toHaveTextContent(REGION_B.id)
  })

  it("行の余白を押すと選択がトグルする", async () => {
    const user = userEvent.setup()
    render(<RegionTableHarness regions={[REGION_A, REGION_B]} />, {
      wrapper: createQueryWrapper(),
    })

    // ページ番号のマスは入力欄を持たないので、行のトグルがそのまま効く
    const pageCell = screen.getAllByText("1")[0]
    await user.click(pageCell)
    expect(screen.getByTestId("selected")).toHaveTextContent(REGION_A.id)

    await user.click(pageCell)
    expect(screen.getByTestId("selected")).toHaveTextContent("なし")
  })

  it("取り直しで前の行が消えても、選択が別の領域へ移らない", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <RegionTableHarness regions={[REGION_A, REGION_B, REGION_C]} />,
      { wrapper: createQueryWrapper() }
    )

    await user.click(labelInputOf(REGION_B.id))
    expect(screen.getByTestId("selected")).toHaveTextContent(REGION_B.id)

    // 他の教員が先頭の領域を消した（＝取り直しで行が1つ繰り上がる）
    rerender(<RegionTableHarness regions={[REGION_B, REGION_C]} />)

    expect(screen.getByTestId("selected")).toHaveTextContent(REGION_B.id)
    // 光っているのも同じ領域の行（添字で持っていた頃はここが1つ下へずれた）
    expect(rowOf(REGION_B.id).className).toContain("bg-primary/10")
    expect(rowOf(REGION_C.id).className).not.toContain("bg-primary/10")
  })
})

describe("表は担当を持たない", () => {
  it("担当列そのものが無い（直す口は「採点担当」タブの対応表1か所）", () => {
    render(<RegionTableHarness regions={[REGION_A]} />, {
      wrapper: createQueryWrapper(),
    })

    expect(
      screen.queryByRole("columnheader", { name: "担当" })
    ).not.toBeInTheDocument()
  })
})
