// @vitest-environment jsdom
/**
 * `EntityListPage` の検査（段階64の共通部品②）。
 *
 * 固定するのは2組。
 *
 * 1. **当たり判定の割り方。** 行を押すと概要へ飛ぶ／**チェックボックスを押しても飛ばない**／
 *    **「…」を押しても飛ばない**／「次のステップ」は概要ではなくそちらへ飛ぶ
 * 2. **出し分け。** 読み込み中／1件も無いとき／絞り込みで0件のとき
 *
 * ## 共通のレンダラ用セットアップ（`__tests__/renderer/setup.ts`）を読み込んでいない理由
 *
 * あちらの `next/navigation` モックは `useRouter()` が呼ばれるたびに新しい `vi.fn()` を
 * 作って返すので、**どこへ飛んだかを確かめられない**。`vi.mock` は同じ道に対して後から
 * 登録したほうが勝ち、共通セットアップは（テスト本体の hoist された `vi.mock` より後に）
 * import で実行されるため、こちらで上書きすることもできない。よってここでは
 * 共通セットアップを読まず、必要なぶんだけ自分で用意する。
 *
 * 幅は要らない（畳みの検査は `overflowToolbar.test.tsx` が持つ）。jsdom には
 * `ResizeObserver` が無く、`OverflowToolbar` はそのとき何も畳まないので、
 * ここでは操作がそのまま並ぶ。
 */

import "@testing-library/jest-dom/vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EntityListPage } from "@/components/common/EntityListPage"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"

/** hoist される `vi.mock` の中から参照するので、こちらも hoist して作る */
const { pushSpy } = vi.hoisted(() => ({ pushSpy: vi.fn() }))

/**
 * ヘッダー左のクイックアクセス（戻る／進む）は差し替える。
 *
 * 中身は Electron のセッション履歴を引く `useNavigationHistory` で、
 * `QueryClientProvider` と `window.electronAPI` が要る。ここで見たいのは一覧の
 * 列と当たり判定なので、その2つを持ち込まずに済ませる（履歴の側の検査は
 * 呼ばれ方ではなく `useNavigationHistory` 自身が持つべきもの）。
 */
vi.mock("@/components/layout/HistoryNavButtons", () => ({
  HistoryNavButtons: () => <div data-testid="history-nav-buttons" />,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

/** 一覧に載せる行。日付は Prisma の行がそのまま IPC を通った姿（`Date`） */
interface TestExamRow {
  id: string
  examName: string
  examDate: Date | null
  updatedAt: Date
}

const ROWS: TestExamRow[] = [
  {
    id: "exam-1",
    examName: "期末考査",
    examDate: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-02T00:00:00.000Z"),
  },
  {
    id: "exam-2",
    examName: "中間考査",
    examDate: null,
    updatedAt: new Date("2026-01-05T00:00:00.000Z"),
  },
]

/** ページ送りを見るための行。名前で並べれば順序が決まる */
function manyRows(count: number): TestExamRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `exam-${String(i + 1).padStart(3, "0")}`,
    examName: `試験${String(i + 1).padStart(3, "0")}`,
    examDate: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
  }))
}

const ACTIONS: ToolbarAction[] = [
  {
    id: "search",
    priority: 100,
    node: <input aria-label="検索欄" />,
    collapsedNode: <input aria-label="検索欄（畳んだ姿）" />,
  },
]

/**
 * jsdom は `ResizeObserver` を持たない。ページ送りの「自動」がこれで高さを測るので、
 * 何も観測しないものを置く（高さ 0 のまま＝件数は既定へ落ちる）。
 */
global.ResizeObserver = class implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const toggleSelectSpy = vi.fn()
const toggleSelectAllSpy = vi.fn()

/** 絞り込みは列見出しの popover に入る。ここでは値を持つだけの空の設定を渡す */
const NO_DATE_FILTER = {
  from: "",
  to: "",
  onFromChange: () => {},
  onToChange: () => {},
}

function renderList(
  overrides: Partial<Parameters<typeof EntityListPage<TestExamRow>>[0]> = {}
) {
  return render(
    <EntityListPage<TestExamRow>
      title="試験一覧"
      rows={ROWS}
      totalCount={ROWS.length}
      isLoading={false}
      name={(exam) => exam.examName}
      summary={(exam) => <span>{`要約: ${exam.id}`}</span>}
      dateLabel="試験日"
      referenceDate={(exam) => exam.examDate}
      updatedAt={(exam) => exam.updatedAt}
      overviewUrl={(exam) => `/exams/${exam.id}`}
      nextStep={(exam) => ({
        label: "採点を始める",
        url: `/exams/${exam.id}/07-score-at-once`,
      })}
      rowMenu={(exam) => (
        <button type="button" aria-label={`${exam.examName}の操作`}>
          …
        </button>
      )}
      actions={ACTIONS}
      search={{ term: "", onChange: () => {}, placeholder: "試験名で検索" }}
      dateFilter={NO_DATE_FILTER}
      updatedAtFilter={NO_DATE_FILTER}
      selectedIds={new Set<string>()}
      onToggleSelect={toggleSelectSpy}
      onToggleSelectAll={toggleSelectAllSpy}
      allSelected={false}
      empty={{
        message: "まだ試験がありません",
        action: <button type="button">最初の試験を作成</button>,
      }}
      noMatchMessage="条件に一致する試験がありません"
      sortStorageKey="entityListPage-test-sort"
      {...overrides}
    />
  )
}

function rowOf(examName: string) {
  return screen.getByRole("row", { name: `${examName}の概要を開く` })
}

beforeEach(() => {
  localStorage.clear()
  pushSpy.mockClear()
  toggleSelectSpy.mockClear()
  toggleSelectAllSpy.mockClear()
})

afterEach(() => {
  cleanup()
})

describe("EntityListPage の当たり判定", () => {
  it("行を押すと概要へ飛ぶ", () => {
    renderList()

    fireEvent.click(rowOf("期末考査"))

    expect(pushSpy).toHaveBeenCalledWith("/exams/exam-1")
  })

  it("チェックボックスを押しても飛ばない（選択だけが動く）", () => {
    renderList()

    fireEvent.click(
      within(rowOf("期末考査")).getByRole("checkbox", {
        name: "期末考査を選択",
      })
    )

    expect(toggleSelectSpy).toHaveBeenCalledWith("exam-1", true)
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it("「…」を押しても飛ばない", () => {
    renderList()

    fireEvent.click(
      within(rowOf("期末考査")).getByRole("button", { name: "期末考査の操作" })
    )

    expect(pushSpy).not.toHaveBeenCalled()
  })

  it("「次のステップ」は概要ではなくその飛び先へ", () => {
    renderList()

    fireEvent.click(
      within(rowOf("期末考査")).getByRole("button", { name: "採点を始める" })
    )

    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalledWith("/exams/exam-1/07-score-at-once")
  })

  it("「詳細」の列は持たない（行そのものが導線）", () => {
    renderList()

    expect(screen.queryByText("詳細")).toBeNull()
  })
})

describe("EntityListPage の出し分け", () => {
  it("読み込み中は読み込み中とだけ言う", () => {
    renderList({ rows: [], totalCount: 0, isLoading: true })

    expect(screen.getByText("読み込み中...")).toBeInTheDocument()
    expect(screen.queryByText("まだ試験がありません")).toBeNull()
    expect(screen.queryByText("条件に一致する試験がありません")).toBeNull()
  })

  it("1件も無いときは作成への導線を出す", () => {
    renderList({ rows: [], totalCount: 0 })

    expect(screen.getByText("まだ試験がありません")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "最初の試験を作成" })
    ).toBeInTheDocument()
    expect(screen.queryByText("条件に一致する試験がありません")).toBeNull()
  })

  it("絞り込みで0件のときは作成へ誘わない", () => {
    renderList({ rows: [], totalCount: 2 })

    expect(
      screen.getByText("条件に一致する試験がありません")
    ).toBeInTheDocument()
    expect(screen.queryByText("まだ試験がありません")).toBeNull()
    // 絞り込んだ結果であることが件数でわかる
    expect(screen.getByText("0 / 2件")).toBeInTheDocument()
  })

  it("列は6つで、並びまで固定（増えても減っても落ちる）", () => {
    renderList()

    // 4画面が同じ列を同じ順で持つことの錠。画面固有の列を足す口が無いことは
    // 型（`EntityListPageProps` に列の定義が無い）が担保し、ここでは並びを固定する
    const columnHeaders = screen
      .getAllByRole("columnheader")
      .map((columnHeader) => columnHeader.textContent?.trim() ?? "")
    expect(columnHeaders).toEqual([
      "",
      "名前",
      "試験日",
      "更新日時",
      "次のステップ",
      "",
    ])
  })

  it("ヘッダーは1行で、題を中央に持つ", () => {
    renderList()

    expect(
      screen.getByRole("heading", { level: 1, name: "試験一覧" })
    ).toBeInTheDocument()
    // 左のクイックアクセス（戻る／進む）も同じ行に居る
    expect(screen.getByTestId("history-nav-buttons")).toBeInTheDocument()
  })

  it("1件も無くても操作（検索欄）は消えない", () => {
    renderList({ rows: [], totalCount: 0 })

    // 幅を測るための控えの並びにも同じ検索欄が居る（`OverflowToolbar`）ので、
    // 本物の並び＝ツールバーの中から引く
    const toolbar = screen.getByRole("toolbar", { name: "一覧の操作" })
    expect(within(toolbar).getByLabelText("検索欄")).toBeInTheDocument()
  })

  it("日付列の見出しは画面ごとの語、未設定の日付は空欄にしない", () => {
    renderList()

    expect(
      screen.getByRole("columnheader", { name: /試験日/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: /更新日時/ })
    ).toBeInTheDocument()
    // examDate が null の行も「—」で埋まる（列に穴を作らない）
    expect(within(rowOf("中間考査")).getByText("—")).toBeInTheDocument()
  })
})

describe("列見出しが並べ替えと絞り込みを持つ", () => {
  it("見出しを押すと、昇順・降順と絞り込みが1つの popover に出る", async () => {
    renderList()

    fireEvent.click(screen.getByRole("button", { name: /名前/ }))

    expect(
      await screen.findByRole("button", { name: "昇順" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "降順" })).toBeInTheDocument()
    // 横断検索は名前列の popover の中（ヘッダー右には置かない）
    expect(screen.getByLabelText("試験名で検索")).toBeInTheDocument()
  })

  it("「昇順」「降順」は回さず名指しで並べる", async () => {
    renderList({ rows: manyRows(3), totalCount: 3 })

    const openNameFilter = () =>
      fireEvent.click(screen.getByRole("button", { name: /名前/ }))
    const rowNames = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.getAttribute("aria-label"))

    openNameFilter()
    fireEvent.click(await screen.findByRole("button", { name: "昇順" }))
    expect(rowNames()).toEqual([
      "試験001の概要を開く",
      "試験002の概要を開く",
      "試験003の概要を開く",
    ])

    // 同じ「昇順」をもう一度押しても向きは回らない（押した通りになる）
    openNameFilter()
    fireEvent.click(await screen.findByRole("button", { name: "昇順" }))
    expect(rowNames()[0]).toBe("試験001の概要を開く")

    openNameFilter()
    fireEvent.click(await screen.findByRole("button", { name: "降順" }))
    expect(rowNames()).toEqual([
      "試験003の概要を開く",
      "試験002の概要を開く",
      "試験001の概要を開く",
    ])
  })

  it("タグと学級は名前列の popover に同居する（渡した画面だけ）", async () => {
    renderList({
      tagFilter: {
        options: [{ id: "tag-1", name: "中間" }],
        selectedIds: new Set<string>(),
        onToggle: () => {},
        onClear: () => {},
      },
      classroomFilter: {
        options: [{ id: "classroom-1", name: "1年A組" }],
        selectedIds: new Set<string>(),
        onToggle: () => {},
        onClear: () => {},
      },
    })

    fireEvent.click(screen.getByRole("button", { name: /名前/ }))

    expect(await screen.findByText("タグ")).toBeInTheDocument()
    expect(screen.getByText("中間")).toBeInTheDocument()
    expect(screen.getByText("学級")).toBeInTheDocument()
    expect(screen.getByText("1年A組")).toBeInTheDocument()
  })

  it("並べ替えているあいだは、filter の代わりに向きを出す", async () => {
    const { container } = renderList()
    const nameHead = () => screen.getByRole("columnheader", { name: /名前/ })

    // 並べていない列は filter のまま
    expect(nameHead()).toHaveAttribute("aria-sort", "none")
    expect(container.querySelector(".lucide-list-filter")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /名前/ }))
    fireEvent.click(await screen.findByRole("button", { name: "降順" }))

    expect(nameHead()).toHaveAttribute("aria-sort", "descending")
    // 印は1つだけ。filter は chevron に置き換わる（並べて2つ出さない）
    expect(nameHead().querySelector(".lucide-chevron-down")).not.toBeNull()
    expect(nameHead().querySelector(".lucide-list-filter")).toBeNull()
  })

  it("「次のステップ」列は絞り込みを持たない", () => {
    renderList()

    // 絞り込みを持つ列だけが押せる見出しになる（名前・試験日・更新日時の3つ）
    expect(screen.queryByRole("button", { name: /次のステップ/ })).toBeNull()
  })
})

describe("日付の出し方", () => {
  it("試験日は yy/mm/dd", () => {
    renderList({
      rows: [
        {
          id: "exam-1",
          examName: "期末考査",
          examDate: new Date(2026, 2, 1),
          updatedAt: new Date(2026, 2, 2),
        },
      ],
      totalCount: 1,
    })

    expect(screen.getByText("26/03/01")).toBeInTheDocument()
  })

  it("更新日時は今日と昨日だけ時刻まで出す", () => {
    const now = new Date()
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      13,
      24
    )
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      9,
      5
    )
    renderList({
      rows: [
        {
          id: "exam-1",
          examName: "今日の試験",
          examDate: null,
          updatedAt: today,
        },
        {
          id: "exam-2",
          examName: "昨日の試験",
          examDate: null,
          updatedAt: yesterday,
        },
      ],
      totalCount: 2,
    })

    expect(screen.getByText("今日 13:24")).toBeInTheDocument()
    expect(screen.getByText("昨日 09:05")).toBeInTheDocument()
  })
})

describe("ページ送り", () => {
  it("1ページに入りきらない行は次のページへ回す", () => {
    renderList({ rows: manyRows(12), totalCount: 12 })

    // 高さが測れないので既定の10件（`FALLBACK_PAGE_SIZE`）
    expect(screen.getByText("12 件中 1〜10 件")).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(11) // 見出し + 10行

    fireEvent.click(screen.getByRole("link", { name: "次のページ" }))

    expect(screen.getByText("12 件中 11〜12 件")).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(3)
  })

  it("1ページに収まってもフッターは消えない（一覧の高さを動かさない）", () => {
    renderList()

    expect(screen.getByText("2 件中 1〜2 件")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "次のページ" })).toBeNull()
  })
})
