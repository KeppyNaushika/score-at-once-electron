// @vitest-environment jsdom
/**
 * 「使い方」は**完全一致でしか当てない**、を固定する。
 *
 * かつては当たらなかったときに部分一致で探していた
 * （`lastSegment.includes(key.split("-")[1])`）。ヘルプが一覧ページにしか置かれて
 * いないうちは表に出なかったが、段のヘッダー（`WorkflowTabHeader`）が全画面で呼ぶ
 * ようになった途端、**別の画面の手引きを出す**ようになった。
 *
 * | 開いている画面                        | 出ていた手引き        |
 * | ------------------------------------- | --------------------- |
 * | 成績 `04-manual-scores`               | 一括採点（試験 07）   |
 * | 成績 `02-students` / 資料 `02-students` | 受験生徒管理（試験 05） |
 * | 成績 `07-export` / 解答用紙 `02-export` | 結果出力（試験 09）   |
 *
 * **無いなら出さない**が正しい。似たものを出すのは、無いより悪い。
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { usePageHelp } from "@/components/help/usePageHelp"

const navigation = vi.hoisted(() => ({ pathname: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}))

/** フックの返す「使い方」だけを描く */
function HelpProbe() {
  const { helpButton } = usePageHelp()
  return <div>{helpButton}</div>
}

afterEach(() => {
  cleanup()
})

function renderHelpAt(pathname: string) {
  navigation.pathname = pathname
  render(<HelpProbe />)
}

/** 「使い方」が出ているか */
function hasHelpButton(): boolean {
  return screen.queryByRole("button", { name: "使い方" }) !== null
}

describe("ページごとの「使い方」", () => {
  it("手引きのある画面には出る", () => {
    renderHelpAt("/exams/exam-1/01-upload")

    expect(hasHelpButton()).toBe(true)
  })

  it("一覧のように名前で引ける画面にも出る", () => {
    renderHelpAt("/exams")

    expect(hasHelpButton()).toBe(true)
  })

  it.each([
    ["/grades/grade-1/04-manual-scores", "一括採点（試験 07）"],
    ["/grades/grade-1/02-students", "受験生徒管理（試験 05）"],
    ["/coursework/coursework-1/04-scores", "一括採点（試験 07）"],
    ["/coursework/coursework-1/02-students", "受験生徒管理（試験 05）"],
    ["/grades/grade-1/07-export", "結果出力（試験 09）"],
    ["/answer-sheet-builder/asb-1/02-export", "結果出力（試験 09）"],
  ])("手引きの無い %s では出さない（かつては %s を出していた）", (pathname) => {
    renderHelpAt(pathname)

    expect(hasHelpButton()).toBe(false)
  })
})
