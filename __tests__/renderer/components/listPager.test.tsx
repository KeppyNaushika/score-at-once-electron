// @vitest-environment jsdom
/**
 * ページ送りの検査。
 *
 * 見るのは**省略記号**。ページ数が3桁になると端と現在地の前後しかボタンが出ないので、
 * 畳まれた区間へは「次へ」を何十回も押すしかなかった。押して番号を打てるようにした
 * ことを固定する。
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ListPager } from "@/components/common/ListPager"

/** jsdom は `ResizeObserver` を持たない。popover の位置決めが要求する */
global.ResizeObserver = class implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const onPageChange = vi.fn()

function renderPager(pageNumber: number, pageCount: number) {
  return render(
    <ListPager
      pageNumber={pageNumber}
      pageCount={pageCount}
      onPageChange={onPageChange}
    />
  )
}

/** 省略記号のボタン（畳まれた区間は複数あるので、いちばん左を取る） */
function firstEllipsis() {
  return screen.getAllByRole("button", {
    name: "ページ番号を指定して移動",
  })[0]
}

beforeEach(() => {
  onPageChange.mockClear()
})

afterEach(() => {
  cleanup()
})

describe("畳まれた区間", () => {
  it("ページが少なければ省略しない", () => {
    renderPager(1, 3)

    expect(
      screen.queryByRole("button", { name: "ページ番号を指定して移動" })
    ).toBeNull()
    expect(screen.getByRole("link", { name: "2ページ目" })).toBeInTheDocument()
  })

  it("端と現在地の前後だけを残す", () => {
    renderPager(50, 100)

    const pageLinks = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"))
    expect(pageLinks).toEqual([
      "前のページ",
      "1ページ目",
      "49ページ目",
      "50ページ目",
      "51ページ目",
      "100ページ目",
      "次のページ",
    ])
  })
})

describe("省略記号からページを指定する", () => {
  it("押すと番号を打つ欄が出て、打った先へ移る", async () => {
    renderPager(50, 100)

    fireEvent.click(firstEllipsis())

    const pageInput = await screen.findByLabelText("移動先のページ（1〜100）")
    fireEvent.change(pageInput, { target: { value: "23" } })
    fireEvent.click(screen.getByRole("button", { name: "移動" }))

    expect(onPageChange).toHaveBeenCalledWith(23)
  })

  it("総ページ数を超える番号では移れない", async () => {
    renderPager(50, 100)

    fireEvent.click(firstEllipsis())

    const pageInput = await screen.findByLabelText("移動先のページ（1〜100）")
    fireEvent.change(pageInput, { target: { value: "101" } })

    expect(screen.getByRole("button", { name: "移動" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "移動" }))
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it("数でないものでも移れない", async () => {
    renderPager(50, 100)

    fireEvent.click(firstEllipsis())

    const pageInput = await screen.findByLabelText("移動先のページ（1〜100）")
    fireEvent.change(pageInput, { target: { value: "あ" } })

    expect(screen.getByRole("button", { name: "移動" })).toBeDisabled()
  })

  it("閉じると打ちかけを捨てる（次に開いたとき前の入力が残らない）", async () => {
    renderPager(50, 100)

    fireEvent.click(firstEllipsis())
    fireEvent.change(await screen.findByLabelText("移動先のページ（1〜100）"), {
      target: { value: "23" },
    })
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })

    fireEvent.click(firstEllipsis())

    expect(
      await screen.findByLabelText("移動先のページ（1〜100）")
    ).toHaveValue("")
  })
})
