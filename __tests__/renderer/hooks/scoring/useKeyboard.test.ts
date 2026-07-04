// @vitest-environment jsdom
/**
 * useKeyboard フックのテスト
 *
 * テキスト編集モーダル表示中（isTextEditing=true）は、フォーカス位置に
 * 関わらず Delete/Backspace による選択要素の削除を抑制することを検証する。
 * （モーダル内編集中の Backspace でアノテーションごと削除されるバグの回帰防止）
 */

import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, type Mock, vi } from "vitest"

import { useKeyboard } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/interaction/useKeyboard"

interface Handlers {
  setIsShiftPressed: Mock<(pressed: boolean) => void>
  setIsCtrlPressed: Mock<(pressed: boolean) => void>
  removeDrawingElement: Mock<(id: string) => void>
}

function mountKeyboard(opts: {
  selectedElementIds: string[]
  isTextEditing: boolean
}): Handlers {
  const handlers: Handlers = {
    setIsShiftPressed: vi.fn<(pressed: boolean) => void>(),
    setIsCtrlPressed: vi.fn<(pressed: boolean) => void>(),
    removeDrawingElement: vi.fn<(id: string) => void>(),
  }
  renderHook(() =>
    useKeyboard({
      selectedElementIds: opts.selectedElementIds,
      isTextEditing: opts.isTextEditing,
      setIsShiftPressed: handlers.setIsShiftPressed,
      setIsCtrlPressed: handlers.setIsCtrlPressed,
      removeDrawingElement: handlers.removeDrawingElement,
    })
  )
  return handlers
}

/** 指定要素を target として keydown を window までバブルさせる */
function pressKeyOn(target: EventTarget, key: string) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  )
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.clearAllMocks()
})

describe("useKeyboard - 削除ショートカットのガード", () => {
  it("通常時: 非編集要素上の Backspace は選択要素を削除する", () => {
    const handlers = mountKeyboard({
      selectedElementIds: ["e1", "e2"],
      isTextEditing: false,
    })

    pressKeyOn(document.body, "Backspace")

    expect(handlers.removeDrawingElement).toHaveBeenCalledTimes(2)
    expect(handlers.removeDrawingElement).toHaveBeenCalledWith("e1")
    expect(handlers.removeDrawingElement).toHaveBeenCalledWith("e2")
  })

  it("通常時: Delete キーでも選択要素を削除する", () => {
    const handlers = mountKeyboard({
      selectedElementIds: ["e1"],
      isTextEditing: false,
    })

    pressKeyOn(document.body, "Delete")

    expect(handlers.removeDrawingElement).toHaveBeenCalledExactlyOnceWith("e1")
  })

  it("修正の核心: テキスト編集モーダル表示中はフォーカスが外れていても削除しない", () => {
    // モーダルは開いているが、フォーカスは textarea ではなく body にある状況
    const handlers = mountKeyboard({
      selectedElementIds: ["e1"],
      isTextEditing: true,
    })

    pressKeyOn(document.body, "Backspace")

    expect(handlers.removeDrawingElement).not.toHaveBeenCalled()
  })

  it("既存の保険: 入力欄(textarea)にフォーカスがある場合は削除しない", () => {
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)

    const handlers = mountKeyboard({
      selectedElementIds: ["e1"],
      isTextEditing: false,
    })

    pressKeyOn(textarea, "Backspace")

    expect(handlers.removeDrawingElement).not.toHaveBeenCalled()
  })

  it("選択要素が無ければ何もしない", () => {
    const handlers = mountKeyboard({
      selectedElementIds: [],
      isTextEditing: false,
    })

    pressKeyOn(document.body, "Backspace")

    expect(handlers.removeDrawingElement).not.toHaveBeenCalled()
  })
})
