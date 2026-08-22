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

const ACTIONS: ToolbarAction[] = [
  {
    id: "search",
    priority: 100,
    node: <input aria-label="検索欄" />,
    collapsedNode: <input aria-label="検索欄（畳んだ姿）" />,
  },
]

const toggleSelectSpy = vi.fn()
const toggleSelectAllSpy = vi.fn()

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
