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

import { cleanup, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"

// 共通セットアップ（`__tests__/renderer/setup.ts`）は取り込まない。あちらは
// usePathname を "/" に固定していて、`vi.mock` は後から読み込まれた方が勝つため、
// 取り込むと「いまどのページか」を差し替えられなくなる
const navigation = vi.hoisted(() => ({ pathname: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  // GuardedLink がぶら下がる NavigationGuardContext が読み込み時に import する。
  // Provider は描かないので呼ばれないが、束ねる時点で欠けていると落ちる
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

// next/link は App Router の文脈（AppRouterContext）を要求する。ここで見たいのは
// 行き先の組み立てと現在地の判定なので、素の <a> に替えて文脈ごと外す
vi.mock("next/link", () => ({
  default: ({ children, ...anchorProps }: ComponentProps<"a">) => (
    <a {...anchorProps}>{children}</a>
  ),
}))

afterEach(() => {
  cleanup()
})

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
    />
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

  it("一覧への導線は「一覧へ戻る」の1つだけ（パンくずを置かない）", () => {
    renderHeaderAt(examHref)

    const listLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/exams")
    // 同じ行き先を2か所から出さない。パンくずを戻すとここが2つになる
    expect(listLinks).toHaveLength(1)
    expect(listLinks[0].textContent).toContain("一覧へ戻る")
  })
})
