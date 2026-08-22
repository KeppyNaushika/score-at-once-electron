// @vitest-environment jsdom
/**
 * 段のタブの「いまどこに居るか」を固定する。
 *
 * 置き換える前のヘッダーは `pathname.includes(step.path)` で現在地を決めていた。
 * これは2つの理由で壊れる:
 *
 * - 概要の path は空文字（実体そのもののURL）で、`includes("")` は常に真。
 *   概要をタブに並べた途端、どの段を開いても概要が一緒に光る
 * - 段どうしでも、片方の path が他方の先頭に重なれば両方が当たる
 *   （`/05-students` と `/05-students-import`）
 *
 * どちらも「たまたま今は当たっていない」だけで、段を1つ足せば戻ってくる。
 * そこで完全一致であることを、実際に描いた `WorkflowTabHeader` の出力
 * （`aria-current="page"` が付く枚数と、どれに付くか）で押さえる。
 */

import "@testing-library/jest-dom/vitest"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps, ReactNode } from "react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { NavigationGuardProvider } from "@/contexts/NavigationGuardContext"
import { useNavigationGuard } from "@/hooks/useNavigationGuard"

// 共通セットアップ（`__tests__/renderer/setup.ts`）は取り込まない。あちらは
// usePathname を "/" に固定していて、`vi.mock` は後から読み込まれた方が勝つため、
// 取り込むと「いまどのページか」を差し替えられなくなる
const navigation = vi.hoisted(() => ({ pathname: "/" }))

// 呼ばれたかを見たいので、毎回新しい関数を作らず1組を使い回す
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  // GuardedLink がぶら下がる NavigationGuardContext が読み込み時に import する
  useRouter: () => router,
}))

// next/link は App Router の文脈（AppRouterContext）を要求する。ここで見たいのは
// 行き先の組み立てと現在地の判定なので、素の <a> に替えて文脈ごと外す
vi.mock("next/link", () => ({
  default: ({ children, ...anchorProps }: ComponentProps<"a">) => (
    <a {...anchorProps}>{children}</a>
  ),
}))

/**
 * 戻る／進むが押せるかは Electron のセッション履歴が決める
 * （`useNavigationHistory` → `navigation:get-state`）。窓の履歴そのものなので、
 * ここではその返事を差し替えて「履歴の端に居るか」を作る。
 */
const getNavigationState = vi.fn()

Object.defineProperty(window, "electronAPI", {
  value: {
    navigation: { getState: getNavigationState, goToIndex: vi.fn() },
  },
  configurable: true,
})

/** 履歴の端（開いた直後で、戻り先も進み先も無い） */
function atHistoryEdge() {
  getNavigationState.mockResolvedValue({
    canGoBack: false,
    canGoForward: false,
    activeIndex: 0,
    entries: [],
  })
}

beforeEach(() => {
  atHistoryEdge()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/**
 * 本物と同じ入れ子で包む。ヘッダーは履歴の状態を IPC で引き（QueryClient）、
 * 移動を未保存のガードへ通す（NavigationGuardProvider）。
 */
function TestProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // 取れなかったときは黙って諦める（履歴が無い＝端として描く）
        defaultOptions: { queries: { retry: false } },
      })
  )
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationGuardProvider>{children}</NavigationGuardProvider>
    </QueryClientProvider>
  )
}

/** 試験のタブ（概要込みで9枚）。実物と同じ形で、段の枚数の多さもそのまま持つ */
const examTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", path: "" },
  { id: "01-upload", label: "1. 模範解答", path: "/01-upload" },
  { id: "02-template", label: "2. 採点領域", path: "/02-template" },
  { id: "03-region-info", label: "3. 領域情報", path: "/03-region-info" },
  { id: "04-question-group", label: "4. 小計点", path: "/04-question-group" },
  { id: "05-students", label: "5. 受験生徒", path: "/05-students" },
  {
    id: "06-student-answers",
    label: "6. 生徒答案",
    path: "/06-student-answers",
  },
  { id: "07-score-at-once", label: "7. 採点", path: "/07-score-at-once" },
  { id: "08-export", label: "8. 結果", path: "/08-export" },
]

const examHref = "/exams/exam-1"

/** 指定のページを開いた状態でヘッダーを描く */
function renderHeaderAt(
  pathname: string,
  tabs: readonly WorkflowTab[] = examTabs,
  entityHref: string = examHref
) {
  navigation.pathname = pathname
  render(
    <WorkflowTabHeader
      listHref="/exams"
      entityName="期末考査"
      entityHref={entityHref}
      tabs={tabs}
    />,
    { wrapper: TestProviders }
  )
}

/** いま現在地になっているタブの名前。0枚でも2枚でも、そのまま返す */
function currentTabLabels(): string[] {
  const tabNav = screen.getByRole("navigation", { name: "ワークフローの段" })
  return within(tabNav)
    .getAllByRole("link")
    .filter((tabLink) => tabLink.getAttribute("aria-current") === "page")
    .map((tabLink) => tabLink.textContent ?? "")
}

describe("WorkflowTabHeader の現在地", () => {
  it("概要ページ（NN- の付かないパス）では概要が現在地になる", () => {
    renderHeaderAt(examHref)

    expect(currentTabLabels()).toEqual(["概要"])
  })

  it.each(examTabs.filter((tab) => tab.path !== ""))(
    "$label のページではその段だけが現在地になる",
    (tab) => {
      renderHeaderAt(examHref + tab.path)

      // 概要が混ざらないことが肝。`includes` だと空文字が常に当たり、
      // ここが ["概要", tab.label] の2枚になる
      expect(currentTabLabels()).toEqual([tab.label])
    }
  )

  it("段のページを開いても概要は現在地にならない", () => {
    renderHeaderAt(`${examHref}/03-region-info`)

    const tabNav = screen.getByRole("navigation", { name: "ワークフローの段" })
    const overviewTab = within(tabNav).getByRole("link", { name: "概要" })
    expect(overviewTab.getAttribute("aria-current")).toBeNull()
  })

  it("パスが部分文字列で被っても、被られた側は現在地にならない", () => {
    // `/05-students` は `/05-students-import` の先頭に丸ごと含まれる。
    // 長い方を開いたとき、部分一致だと短い方まで当たって2枚光る
    const overlappingTabs: readonly WorkflowTab[] = [
      { id: "detail", label: "概要", path: "" },
      { id: "05-students", label: "1. 生徒管理", path: "/05-students" },
      {
        id: "05-students-import",
        label: "2. 生徒取り込み",
        path: "/05-students-import",
      },
    ]

    renderHeaderAt(
      "/coursework/coursework-1/05-students-import",
      overlappingTabs,
      "/coursework/coursework-1"
    )

    expect(currentTabLabels()).toEqual(["2. 生徒取り込み"])
  })

  it("他の実体のページを開いていれば、どの段も現在地にならない", () => {
    // 試験idが違えば完全一致しない。前の試験のタブが光ったままにならないこと
    renderHeaderAt("/exams/exam-2/01-upload")

    expect(currentTabLabels()).toEqual([])
  })
})

describe("WorkflowTabHeader の行き先", () => {
  it("概要は実体そのもののURL、各段はそこに path を継いだURLへ向かう", () => {
    renderHeaderAt(examHref)

    const tabNav = screen.getByRole("navigation", { name: "ワークフローの段" })
    examTabs.forEach((tab) => {
      const tabLink = within(tabNav).getByRole("link", { name: tab.label })
      expect(tabLink.getAttribute("href")).toBe(examHref + tab.path)
    })
  })

  it("一覧への導線はツールバーのアイコン1つだけ（パンくずも右のボタンも置かない）", () => {
    renderHeaderAt(examHref)

    const listLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/exams")
    // 同じ行き先を2か所から出さない。パンくずを戻しても、右端に
    // 「一覧へ戻る」ボタンを足しても、ここが2つになる
    expect(listLinks).toHaveLength(1)
    // アイコンのみなので、名前は読み上げ用のものが要る
    expect(listLinks[0]).toHaveAccessibleName("一覧へ戻る")
  })
})

/**
 * 左のクイックアクセスツールバー。
 *
 * 「戻る／進む」は**閲覧の履歴**であって段の前後ではない。一覧 → 試験A → 試験B と
 * 来たら戻るで試験Aへ帰る、ブラウザと同じ動きを指す。
 */
describe("WorkflowTabHeader のツールバー", () => {
  it("戻る・進む・一覧の3つが、読み上げ用の名前を持って並ぶ", () => {
    renderHeaderAt(examHref)

    const backButton = screen.getByRole("button", { name: "戻る" })
    const forwardButton = screen.getByRole("button", { name: "進む" })
    const listLink = screen.getByRole("link", { name: "一覧へ戻る" })

    // アイコンだけなので、文字は一切出ていない（名前は aria-label が担う）
    expect(backButton.textContent).toBe("")
    expect(forwardButton.textContent).toBe("")
    expect(listLink.textContent).toBe("")
  })
})

describe("WorkflowTabHeader の戻る・進むが押せるか", () => {
  it("履歴の端では押せない（押しても何も起きない死んだボタンを出さない）", async () => {
    renderHeaderAt(examHref)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled()
    })
    expect(screen.getByRole("button", { name: "進む" })).toBeDisabled()
  })

  it("戻り先ができれば押せるようになる", async () => {
    getNavigationState.mockResolvedValue({
      canGoBack: true,
      canGoForward: false,
      activeIndex: 1,
      entries: [],
    })

    renderHeaderAt(examHref)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "戻る" })).toBeEnabled()
    })
    // 戻ったあとでなければ進み先は無い
    expect(screen.getByRole("button", { name: "進む" })).toBeDisabled()
  })

  it("アプリを通さず外から履歴を動かされても、押せるかどうかがずれない", async () => {
    // Alt+← やマウスの第4ボタンはアプリを経由しないので、アプリ側で行き来を
    // 数えているとずれる。窓のセッション履歴に訊いているのでずれない
    getNavigationState.mockResolvedValue({
      canGoBack: false,
      canGoForward: true,
      activeIndex: 0,
      entries: [],
    })

    renderHeaderAt(examHref)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "進む" })).toBeEnabled()
    })
    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled()
  })
})

/** 書きかけを抱えた画面の代役。ヘッダーと同じ Provider の下に置く */
const dirtyDetails = [{ label: "未保存の採点", count: 3 }]

function DirtyPage() {
  useNavigationGuard(true, dirtyDetails)
  return null
}

/** 書きかけがある状態で、戻れる位置にヘッダーを描く */
async function renderDirtyHeader() {
  getNavigationState.mockResolvedValue({
    canGoBack: true,
    canGoForward: false,
    activeIndex: 1,
    entries: [],
  })
  navigation.pathname = examHref
  render(
    <>
      <DirtyPage />
      <WorkflowTabHeader
        listHref="/exams"
        entityName="期末考査"
        entityHref={examHref}
        tabs={examTabs}
      />
    </>,
    { wrapper: TestProviders }
  )
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "戻る" })).toBeEnabled()
  })
}

describe("WorkflowTabHeader の戻るが未保存を捨てないこと", () => {
  it("書きかけがあるとき、戻るは確認を挟んで勝手に遷移しない", async () => {
    await renderDirtyHeader()

    await userEvent.click(screen.getByRole("button", { name: "戻る" }))

    expect(screen.getByText("未保存のデータがあります")).toBeInTheDocument()
    // 確認する前に履歴を動かさない。ガードは popstate を見ていないので、
    // ここで router.back() を直に呼ぶと書きかけを黙って捨てる
    expect(router.back).not.toHaveBeenCalled()
  })

  it("確認して離れると、押すのではなく戻る", async () => {
    await renderDirtyHeader()

    await userEvent.click(screen.getByRole("button", { name: "戻る" }))
    await userEvent.click(screen.getByRole("button", { name: "離れる" }))

    // 保留していたのは行き先ではなく「戻る」という行為。href に潰すと
    // ここが push になり、履歴が戻らず1つ増える
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.push).not.toHaveBeenCalled()
  })

  it("確認で留まると、履歴は動かない", async () => {
    await renderDirtyHeader()

    await userEvent.click(screen.getByRole("button", { name: "戻る" }))
    // ダイアログの「戻る」はツールバーの「戻る」と同名なので、ダイアログの中で探す
    const confirmDialog = screen.getByRole("alertdialog")
    await userEvent.click(
      within(confirmDialog).getByRole("button", { name: "戻る" })
    )

    expect(router.back).not.toHaveBeenCalled()
  })
})
