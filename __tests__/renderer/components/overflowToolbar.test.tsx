// @vitest-environment jsdom
/**
 * `OverflowToolbar` の検査（段階64の共通部品①）。
 *
 * 固定するのは4点。
 *
 * 1. 幅が足りていれば何も畳まない
 * 2. 足りないときは**優先度の低いものから**「…」へ入り、**検索欄は最後まで残る**
 * 3. 幅が戻れば出てくる
 * 4. **振動しない。** 畳んだ直後の見た目がちょうど収まる幅（境界）でも、
 *    何度測り直しても畳み具合が変わらない
 *
 * ## jsdom に幅をどう作ったか
 *
 * jsdom はレイアウトを持たないので `getBoundingClientRect()` は 0 を返し、
 * `ResizeObserver` も無い。そこで**2つとも自前で置き換えている**。
 *
 * - **幅**: `Element.prototype.getBoundingClientRect` を差し替え、要素が
 *   何であるかを**部品が実際に付けている目印**から判定して、テストが持つ幅の表を返す。
 *   器は「直下に `role="toolbar"` を持つ要素」、控えの並びの各項目は
 *   `data-overflow-toolbar-id`、控えの「…」は `data-overflow-toolbar-ghost-overflow`。
 *   目印を使うので、テストのためだけの属性を部品に足していない
 * - **測り直しの合図**: `ResizeObserver` を差し替え、`notifyResize()` で全ての
 *   コールバックを手で呼ぶ。本物は `observe()` した直後にも一度呼ぶので、
 *   描いたあとに1回 `notifyResize()` するのが「初回の測定」にあたる
 *
 * 隙間（`gap`）は jsdom の `getComputedStyle` が値を持たないので 0 になる。
 * 幅の表もそれに合わせて隙間ゼロで組んである。
 */

import "@testing-library/jest-dom/vitest"

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { OverflowToolbar } from "@/components/common/OverflowToolbar"

/** 部品が控えの並びに付ける目印（部品側と揃えること） */
const GHOST_ID_ATTRIBUTE = "data-overflow-toolbar-id"
const GHOST_OVERFLOW_ATTRIBUTE = "data-overflow-toolbar-ghost-overflow"

/** 「…」の幅。畳むかどうかの判定で器の幅から引かれる */
const OVERFLOW_WIDTH = 40

/** 操作ごとの幅。隙間は 0 なので、単純な足し算で境界を作れる */
const ACTION_WIDTHS: Record<string, number> = {
  search: 200,
  tag: 100,
  export: 120,
}

/** テストの途中で書き換える器の幅 */
let containerWidth = 1000

/** 差し替えた `ResizeObserver` が集めたコールバック */
const resizeCallbacks = new Map<ResizeObserver, ResizeObserverCallback>()

class FakeResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.set(this, callback)
  }
  observe() {}
  unobserve() {}
  disconnect() {
    resizeCallbacks.delete(this)
  }
}

/** 本物の `ResizeObserver` が幅の変化で呼ぶのと同じことを手で起こす */
function notifyResize() {
  act(() => {
    for (const [observer, callback] of resizeCallbacks) {
      callback([], observer)
    }
  })
}

/** 器の幅を変えて測り直させる */
function resizeContainerTo(nextWidth: number) {
  containerWidth = nextWidth
  notifyResize()
}

function isContainer(element: Element): boolean {
  return [...element.children].some(
    (child) => child.getAttribute("role") === "toolbar"
  )
}

function measuredWidthOf(element: Element): number {
  if (isContainer(element)) return containerWidth
  if (element.hasAttribute(GHOST_OVERFLOW_ATTRIBUTE)) return OVERFLOW_WIDTH
  const actionId = element.getAttribute(GHOST_ID_ATTRIBUTE)
  if (actionId !== null) return ACTION_WIDTHS[actionId] ?? 0
  return 0
}

const ACTIONS: ToolbarAction[] = [
  {
    id: "search",
    // 検索できない一覧にはしないので、検索欄が最上位
    priority: 100,
    node: <input aria-label="検索欄" />,
    collapsedNode: <input aria-label="検索欄（畳んだ姿）" />,
  },
  {
    id: "tag",
    priority: 50,
    // 並びでは popover のボタン、「…」の中では入れ子にできないので開いた一覧
    node: <button type="button">タグ</button>,
    collapsedNode: <div>タグの一覧</div>,
  },
  {
    id: "export",
    priority: 10,
    node: <button type="button">書き出し</button>,
    collapsedNode: <button type="button">書き出し（畳んだ姿）</button>,
  },
]

/** 見えている並び。控えの並びは兄弟なので、ここに入らない */
function visibleToolbar() {
  return within(screen.getByRole("toolbar", { name: "一覧の操作" }))
}

function renderToolbar() {
  render(<OverflowToolbar actions={ACTIONS} />)
  // 本物の ResizeObserver が observe 直後に配る1回ぶん
  notifyResize()
}

beforeEach(() => {
  containerWidth = 1000
  resizeCallbacks.clear()
  vi.stubGlobal("ResizeObserver", FakeResizeObserver)
  // jsdom は `getBoundingClientRect` を Element.prototype に置いている
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return new DOMRect(0, 0, measuredWidthOf(this), 0)
    }
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("OverflowToolbar", () => {
  it("幅が足りていれば何も畳まない", () => {
    // 420（200+100+120）に対して器は 1000
    renderToolbar()

    const toolbar = visibleToolbar()
    expect(toolbar.getByLabelText("検索欄")).toBeInTheDocument()
    expect(toolbar.getByText("タグ")).toBeInTheDocument()
    expect(toolbar.getByText("書き出し")).toBeInTheDocument()
    expect(toolbar.queryByLabelText("入りきらない操作")).toBeNull()
  })

  it("入りきらないときは優先度の低いものから畳む", () => {
    renderToolbar()
    // 器 350 → 「…」の 40 を引いた 310 に収める。書き出し（優先度10）だけ外せば 300
    resizeContainerTo(350)

    const toolbar = visibleToolbar()
    expect(toolbar.getByLabelText("検索欄")).toBeInTheDocument()
    expect(toolbar.getByText("タグ")).toBeInTheDocument()
    expect(toolbar.queryByText("書き出し")).toBeNull()
    expect(toolbar.getByLabelText("入りきらない操作")).toBeInTheDocument()
  })

  it("さらに狭めても検索欄は最後まで残る", () => {
    renderToolbar()
    // 器 300 → 260 に収める。書き出しとタグを外して検索欄の 200 だけ
    resizeContainerTo(300)

    const toolbar = visibleToolbar()
    expect(toolbar.getByLabelText("検索欄")).toBeInTheDocument()
    expect(toolbar.queryByText("タグ")).toBeNull()
    expect(toolbar.queryByText("書き出し")).toBeNull()
  })

  it("幅が戻れば出てくる", () => {
    renderToolbar()
    resizeContainerTo(300)
    expect(visibleToolbar().queryByText("書き出し")).toBeNull()

    resizeContainerTo(1000)

    const toolbar = visibleToolbar()
    expect(toolbar.getByText("タグ")).toBeInTheDocument()
    expect(toolbar.getByText("書き出し")).toBeInTheDocument()
    expect(toolbar.queryByLabelText("入りきらない操作")).toBeNull()
  })

  it("畳んだ結果がちょうど収まる幅でも振動しない", () => {
    renderToolbar()
    // 340 は「書き出しを畳むと、検索欄200＋タグ100＋…40 = 340 でぴったり」という境界。
    // 畳んだあとの見た目を測り直す作りだと「収まった→戻す→また溢れる」を繰り返す幅
    resizeContainerTo(340)
    expect(visibleToolbar().queryByText("書き出し")).toBeNull()
    expect(visibleToolbar().getByText("タグ")).toBeInTheDocument()

    // 同じ幅のまま何度測り直しても、畳み具合は動かない
    for (let i = 0; i < 5; i++) {
      notifyResize()
      expect(visibleToolbar().queryByText("書き出し")).toBeNull()
      expect(visibleToolbar().getByText("タグ")).toBeInTheDocument()
    }

    // 1px の揺れでも動かない
    resizeContainerTo(341)
    expect(visibleToolbar().queryByText("書き出し")).toBeNull()
    expect(visibleToolbar().getByText("タグ")).toBeInTheDocument()
    resizeContainerTo(340)
    expect(visibleToolbar().queryByText("書き出し")).toBeNull()
    expect(visibleToolbar().getByText("タグ")).toBeInTheDocument()
  })

  it("畳まれたものは「…」の中に collapsedNode の姿で入る", async () => {
    renderToolbar()
    resizeContainerTo(300)

    fireEvent.click(visibleToolbar().getByLabelText("入りきらない操作"))

    // popover は portal なので画面全体から探す
    expect(await screen.findByText("タグの一覧")).toBeInTheDocument()
    expect(screen.getByText("書き出し（畳んだ姿）")).toBeInTheDocument()
  })
})
