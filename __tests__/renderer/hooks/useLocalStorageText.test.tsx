// @vitest-environment jsdom
/**
 * localStorage を読む口を1つへ寄せた（段階51）ことの検査。
 *
 * 固定するのは3点。
 *
 * 1. **事前描画では保存を読まない。** Next.js のサーバ側に localStorage は無いので、
 *    初期値として読むとハイドレーションでずれる。サーバのスナップショットは常に null で、
 *    実際の値はマウント後に入る。
 * 2. **同じ鍵を見ている画面どうしが揃う。** 設定画面の書き込みが、サイドバー本体が持つ
 *    購読へその場で届く（`storage` イベントは同じ document では発火しないので、
 *    自前の通知でここを担う）。
 * 3. **並び順の保存も同じ口を通る。** マウント前は既定の並び、後で保存された並びへ。
 */
import { act, renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it } from "vitest"

import {
  SIDEBAR_SECTIONS,
  useSidebarBehavior,
} from "@/components/layout/sidebarBehavior"
import { useLocalStorageText } from "@/hooks/useLocalStorageText"
import { useTableSort } from "@/hooks/useTableSort"

beforeEach(() => {
  localStorage.clear()
})

describe("useLocalStorageText", () => {
  it("事前描画では保存を読まない", () => {
    localStorage.setItem("sidebarBehavior_exams", "collapse")

    function StoredTextProbe() {
      const { storedText } = useLocalStorageText("sidebarBehavior_exams")
      return <span>{storedText ?? "未読"}</span>
    }

    expect(renderToString(<StoredTextProbe />)).toContain("未読")
  })

  it("マウント後は保存された値を返す", () => {
    localStorage.setItem("sidebarBehavior_exams", "collapse")

    const { result } = renderHook(() =>
      useLocalStorageText("sidebarBehavior_exams")
    )

    expect(result.current.storedText).toBe("collapse")
  })

  it("同じ鍵を見ている別の購読へ書き込みが届く", () => {
    const writer = renderHook(() =>
      useLocalStorageText("sidebarBehavior_exams")
    )
    const reader = renderHook(() =>
      useLocalStorageText("sidebarBehavior_exams")
    )

    act(() => {
      writer.result.current.setStoredText("expand")
    })

    expect(reader.result.current.storedText).toBe("expand")
    expect(localStorage.getItem("sidebarBehavior_exams")).toBe("expand")
  })

  it("鍵が無いときは読まず書かない", () => {
    const { result } = renderHook(() => useLocalStorageText(null))

    act(() => {
      result.current.setStoredText("collapse")
    })

    expect(result.current.storedText).toBeNull()
    expect(localStorage.length).toBe(0)
  })
})

describe("useSidebarBehavior", () => {
  it("設定画面の書き込みがサイドバー側へ届く", () => {
    const section = SIDEBAR_SECTIONS[0]
    const settingsRow = renderHook(() => useSidebarBehavior(section))
    const appShell = renderHook(() => useSidebarBehavior(section))

    act(() => {
      settingsRow.result.current.setBehavior("collapse")
    })

    expect(appShell.result.current.behavior).toBe("collapse")
    expect(localStorage.getItem(section.storageKey)).toBe("collapse")
  })

  it("区分別の設定が無ければ旧キーを見る", () => {
    localStorage.setItem("sidebarBehaviorOnWorkPage", "expand")

    const { result } = renderHook(() => useSidebarBehavior(SIDEBAR_SECTIONS[1]))

    expect(result.current.behavior).toBe("expand")
  })

  it("区分別の設定は旧キーより優先する", () => {
    const section = SIDEBAR_SECTIONS[2]
    localStorage.setItem("sidebarBehaviorOnWorkPage", "expand")
    localStorage.setItem(section.storageKey, "collapse")

    const { result } = renderHook(() => useSidebarBehavior(section))

    expect(result.current.behavior).toBe("collapse")
  })

  it("どこにも設定が無ければ変更しない", () => {
    const { result } = renderHook(() => useSidebarBehavior(SIDEBAR_SECTIONS[3]))

    expect(result.current.behavior).toBe("none")
  })
})

describe("useTableSort", () => {
  const exams = [
    { name: "1学期期末", examDate: "2026-03-01" },
    { name: "2学期中間", examDate: "2026-06-01" },
  ]

  it("事前描画では既定の並び、マウント後に保存された並びへ", () => {
    localStorage.setItem(
      "examList-sort",
      JSON.stringify({ key: "name", direction: "asc" })
    )

    function SortedNamesProbe() {
      const { sortedData } = useTableSort(exams, {
        defaultSort: { key: "examDate", direction: "desc" },
        storageKey: "examList-sort",
      })
      return <span>{sortedData.map((exam) => exam.name).join(",")}</span>
    }

    // 既定（実施日の降順）
    expect(renderToString(<SortedNamesProbe />)).toContain(
      "2学期中間,1学期期末"
    )

    const { result } = renderHook(() =>
      useTableSort(exams, {
        defaultSort: { key: "examDate", direction: "desc" },
        storageKey: "examList-sort",
      })
    )

    // 保存（名前の昇順）
    expect(result.current.sortConfig).toEqual({ key: "name", direction: "asc" })
    expect(result.current.sortedData.map((exam) => exam.name)).toEqual([
      "1学期期末",
      "2学期中間",
    ])
  })

  it("並び替えは保存され、同じ鍵を見ている別の画面へも届く", () => {
    const first = renderHook(() =>
      useTableSort(exams, { storageKey: "examList-sort" })
    )
    const second = renderHook(() =>
      useTableSort(exams, { storageKey: "examList-sort" })
    )

    act(() => {
      first.result.current.requestSort("name")
    })

    expect(second.result.current.sortConfig).toEqual({
      key: "name",
      direction: "asc",
    })
    expect(localStorage.getItem("examList-sort")).toBe(
      JSON.stringify({ key: "name", direction: "asc" })
    )
  })

  it("鍵を渡さないときは保存せず、押すたびに asc→desc→解除と回る", () => {
    const { result } = renderHook(() => useTableSort(exams))

    act(() => {
      result.current.requestSort("name")
    })
    expect(result.current.sortConfig).toEqual({ key: "name", direction: "asc" })

    act(() => {
      result.current.requestSort("name")
    })
    expect(result.current.sortConfig).toEqual({
      key: "name",
      direction: "desc",
    })

    act(() => {
      result.current.requestSort("name")
    })
    expect(result.current.sortConfig).toEqual({ key: null, direction: null })
    expect(localStorage.length).toBe(0)
  })

  it("壊れた保存値は無かったことにする", () => {
    localStorage.setItem("examList-sort", "{")

    const { result } = renderHook(() =>
      useTableSort(exams, {
        defaultSort: { key: "examDate", direction: "desc" },
        storageKey: "examList-sort",
      })
    )

    expect(result.current.sortConfig).toEqual({
      key: "examDate",
      direction: "desc",
    })
  })
})
