// @vitest-environment jsdom
/**
 * `EntityOverviewPage` の検査（段階66の共通部品）。
 *
 * 固定するのは3組。
 *
 * 1. **その場編集が書きに行くこと。** 名前・日付・説明は**1打鍵ごとに即時**に書き、
 *    値が変わっていなければ書かない。名前を消し切った途中でも書かない
 * 2. **段カードの名前・説明・行き先が `workflowTabs` から来ること**
 *    （概要に写しを持たない）。**段の行そのものがリンク**で、別口の「開く」は無い
 * 3. **進み具合の出し方。** 判定できる段だけを分母に `n/m 完了` と数で出し、
 *    材料が無いまとまり（出力）には数そのものを出さない。％も進捗バーも置かない
 * 4. **まとまりの状態。** 進行中なら「次へ: 〈段の名前〉」、済んだなら「完了」、
 *    前が済んでいないなら「前の段の完了を待機中」
 *
 * ## 共通のレンダラ用セットアップを読み込んでいない理由
 *
 * `entityListPage.test.tsx` と同じ。あちらの `next/navigation` モックは
 * `useRouter()` のたびに新しい `vi.fn()` を返すので確かめられない。ここでは
 * 必要なぶんだけ自分で用意する。
 *
 * タグ欄（`EntityTagEditor`）は差し替える。中身はタグ一覧の取得とタグの作成で、
 * `QueryClientProvider` と `window.electronAPI` を持ち込むことになる。ここで見たいのは
 * 概要の骨組みなので、タグの側は「渡された付け替えが呼ばれるか」だけ見る。
 */

import "@testing-library/jest-dom/vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EntityOverviewPage } from "@/components/common/EntityOverviewPage"
import { examWorkflowPhases, examWorkflowTabs } from "@/lib/workflowTabs"

vi.mock("@/components/common/EntityTagEditor", () => ({
  EntityTagEditor: ({ tags }: { tags: { id: string; name: string }[] }) => (
    <div data-testid="tag-editor">{tags.map((tag) => tag.name).join(",")}</div>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => "/exams/exam-1",
  useSearchParams: () => new URLSearchParams(),
}))

const BASICS = {
  name: "期末考査",
  referenceDate: "2026-03-01",
  description: "数学",
}

/** 準備は 5 段のうち 2 段まで済み、採点以降はこれから */
const STEP_COMPLETION: Record<string, boolean | null> = {
  "01-upload": true,
  "02-template": true,
  "03-region-info": false,
  "04-question-group": false,
  "05-students": false,
  "06-student-answers": false,
  "07-score-at-once": false,
  "08-finalize": false,
  "09-export": null,
}

/** 判定できる段が全部済んだところ（出力は元から判定できない） */
const ALL_MEASURABLE_DONE: Record<string, boolean | null> = {
  "01-upload": true,
  "02-template": true,
  "03-region-info": true,
  "04-question-group": true,
  "05-students": true,
  "06-student-answers": true,
  "07-score-at-once": true,
  "08-finalize": true,
  "09-export": null,
}

function renderOverview(
  overrides: {
    onCommitBasics?: (basics: {
      name: string
      referenceDate: string
      description: string
    }) => Promise<void>
    stepCompletion?: Record<string, boolean | null>
  } = {}
) {
  const onCommitBasics =
    overrides.onCommitBasics ?? vi.fn().mockResolvedValue(undefined)
  render(
    <EntityOverviewPage
      nameLabel="試験名"
      dateLabel="試験日"
      basics={BASICS}
      onCommitBasics={onCommitBasics}
      tags={[]}
      onReplaceTags={vi.fn().mockResolvedValue(undefined)}
      stats={[
        { label: "模範解答", value: 3 },
        { label: "受験生徒", value: 120 },
      ]}
      tabs={examWorkflowTabs}
      entityHref="/exams/exam-1"
      phases={examWorkflowPhases}
      stepCompletion={overrides.stepCompletion ?? STEP_COMPLETION}
    />
  )
  return { onCommitBasics }
}

/** 段カード1枚を、まとまりの名前で引く */
function phaseCard(title: string): HTMLElement {
  const heading = screen.getByText(title)
  const card = heading.closest("div[data-slot='card']")
  if (!card) throw new Error(`${title} のカードが見つかりません`)
  return card as HTMLElement
}

afterEach(() => cleanup())

describe("その場編集", () => {
  it("名前を打つとその打鍵で書きに行く（保存ボタンを押させない）", () => {
    const onCommitBasics = vi.fn().mockResolvedValue(undefined)
    renderOverview({ onCommitBasics })

    fireEvent.change(screen.getByLabelText("試験名"), {
      target: { value: "期末考査（数学）" },
    })

    expect(onCommitBasics).toHaveBeenCalledTimes(1)
    expect(onCommitBasics).toHaveBeenCalledWith({
      name: "期末考査（数学）",
      referenceDate: "2026-03-01",
      description: "数学",
    })
  })

  it("値が変わっていなければ書かない", () => {
    const onCommitBasics = vi.fn().mockResolvedValue(undefined)
    renderOverview({ onCommitBasics })

    fireEvent.change(screen.getByLabelText("試験名"), {
      target: { value: BASICS.name },
    })

    expect(onCommitBasics).not.toHaveBeenCalled()
  })

  it("名前を消し切った途中では書かない（次の打鍵で確定する）", () => {
    const onCommitBasics = vi.fn().mockResolvedValue(undefined)
    renderOverview({ onCommitBasics })
    const nameInput = screen.getByLabelText("試験名")

    fireEvent.change(nameInput, { target: { value: "" } })
    expect(onCommitBasics).not.toHaveBeenCalled()
    // 消したことは画面に残る（打った文字が勝手に戻らない）
    expect(nameInput).toHaveValue("")

    fireEvent.change(nameInput, { target: { value: "中" } })
    expect(onCommitBasics).toHaveBeenCalledWith(
      expect.objectContaining({ name: "中" })
    )
  })

  it("日付と説明も同じ打鍵で書く", () => {
    const onCommitBasics = vi.fn().mockResolvedValue(undefined)
    renderOverview({ onCommitBasics })

    fireEvent.change(screen.getByLabelText("試験日"), {
      target: { value: "2026-07-10" },
    })
    fireEvent.change(screen.getByLabelText("説明"), {
      target: { value: "数学I" },
    })

    expect(onCommitBasics).toHaveBeenNthCalledWith(1, {
      name: "期末考査",
      referenceDate: "2026-07-10",
      description: "数学",
    })
    // 2回目は、直前に打った日付も一緒に運ぶ（着地待ちの値を巻き戻さない）
    expect(onCommitBasics).toHaveBeenNthCalledWith(2, {
      name: "期末考査",
      referenceDate: "2026-07-10",
      description: "数学I",
    })
  })
})

describe("段カード", () => {
  it("段の名前と説明は workflowTabs から出す（概要に写しを持たない）", () => {
    renderOverview()
    const preparation = phaseCard("準備")

    // 「1. 模範解答」（タブの短い名前）ではなく長い名前
    expect(within(preparation).getByText("模範解答画像の管理")).toBeVisible()
    expect(within(preparation).getByText("受験生徒の管理")).toBeVisible()
    // その段が何をする所かの一文も、名前と同じ一覧から来る
    expect(
      within(preparation).getByText("試験問題の模範解答画像を取り込む")
    ).toBeVisible()
  })

  it("段の行そのものがリンクで、行き先は実体のURLに段の path を継ぐ", () => {
    renderOverview()
    const preparation = phaseCard("準備")

    // 名前も説明も同じ1本のリンクの中にある（行のどこを押しても段が開く）
    const uploadRow = within(preparation)
      .getByText("模範解答画像の管理")
      .closest("a")
    expect(uploadRow).toHaveAttribute("href", "/exams/exam-1/01-upload")
    expect(uploadRow).toHaveTextContent("試験問題の模範解答画像を取り込む")

    // 準備の5段が5本のリンクとして並ぶ（1段1行）
    expect(
      within(preparation)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
    ).toEqual([
      "/exams/exam-1/01-upload",
      "/exams/exam-1/02-template",
      "/exams/exam-1/03-region-info",
      "/exams/exam-1/04-question-group",
      "/exams/exam-1/05-students",
      // 最後の1本は「次へ」（下の検査で名指しを確かめる）
      "/exams/exam-1/03-region-info",
    ])
  })

  it("進行中のまとまりは「次へ: 〈段の名前〉」で手を付ける先を名指しする", () => {
    renderOverview()
    const nextButton = within(phaseCard("準備")).getByText(
      "次へ: 採点領域の詳細情報設定"
    )

    // まだ済んでいない最初の段（01・02 は済み）へ
    expect(nextButton.closest("a")).toHaveAttribute(
      "href",
      "/exams/exam-1/03-region-info"
    )
  })

  it("行き先を名指ししない「開く」ボタンは置かない", () => {
    renderOverview()
    expect(screen.queryByText("開く")).toBeNull()
  })

  it("判定できる段だけを分母にして数で出す（％も進捗バーも出さない）", () => {
    renderOverview()
    const preparation = phaseCard("準備")

    // 準備は5段のうち2段。％ではなく数で言う（残りが何段か読める）
    expect(within(preparation).getByText("2/5 完了")).toBeVisible()
    expect(within(preparation).queryByText(/%/)).toBeNull()
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it("採点確定は採点のまとまりに並び、他の段と同じく数に入る", () => {
    renderOverview()
    // 確定だけのカードは無い（確定は採点の一部）
    expect(screen.queryByText("確定")).toBeNull()

    const scoring = phaseCard("採点")
    expect(
      within(scoring).getByText("採点の割り当てと確定").closest("a")
    ).toHaveAttribute("href", "/exams/exam-1/08-finalize")
    // 答案・採点・確定の3段が分母になる
    expect(within(scoring).getByText("0/3 完了")).toBeVisible()
  })

  it("判定できない段は数の分母から外れる", () => {
    // 確定だけを「判定できない」に落とすと、分母が3から2へ減る
    renderOverview({
      stepCompletion: { ...STEP_COMPLETION, "08-finalize": null },
    })

    expect(within(phaseCard("採点")).getByText("0/2 完了")).toBeVisible()
  })

  it("出力には数そのものを出さない（何度でも出せるので済みが無い）", () => {
    renderOverview()
    const output = phaseCard("出力")

    expect(within(output).getByText("採点結果のファイル出力")).toBeVisible()
    expect(within(output).queryByText(/^\d+\/\d+ 完了$/)).toBeNull()
  })

  it("前の段が済んでいないまとまりは待機中と言う（「次へ」を出さない）", () => {
    renderOverview()
    const scoring = phaseCard("採点")

    // 03-region-info が済んでいないので、採点はまだ手を付けられない
    expect(within(scoring).getByText("前の段の完了を待機中")).toBeVisible()
    expect(within(scoring).queryByText(/^次へ: /)).toBeNull()
  })

  it("判定できる段が全部済んだまとまりは「完了」と言う", () => {
    renderOverview({ stepCompletion: ALL_MEASURABLE_DONE })
    const preparation = phaseCard("準備")

    expect(within(preparation).getByText("5/5 完了")).toBeVisible()
    // 見出しの数とは別に、まとまりの足元でも済んだことを言う
    expect(within(preparation).getByText("完了")).toBeVisible()
    expect(within(preparation).queryByText(/^次へ: /)).toBeNull()

    // 判定できる段が済めば、その先のまとまりは待機中でなくなる
    const output = phaseCard("出力")
    expect(within(output).queryByText("前の段の完了を待機中")).toBeNull()
    expect(
      within(output).getByText("次へ: 採点結果のファイル出力").closest("a")
    ).toHaveAttribute("href", "/exams/exam-1/09-export")
  })
})

describe("概要ページが持たないもの", () => {
  it("全体の進捗バーを置かない", () => {
    renderOverview()
    expect(screen.queryByText("試験進捗")).toBeNull()
  })

  it("実体の名前を大きな題として出さない（ヘッダーが1回だけ出す）", () => {
    renderOverview()
    expect(screen.queryByRole("heading", { name: "期末考査" })).toBeNull()
  })
})
