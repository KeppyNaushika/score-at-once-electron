// @vitest-environment jsdom
/**
 * 採点マークの移動は「掴んでいる間」だけ。
 *
 * 動かしている途中の姿はローカル状態に持ち、**離したときに1回だけ**書く。採点領域の
 * 編集（02-template の `usePointerHandlers`）・つまみ（`useAsbWriteGate`）・同じ画面の
 * リサイズと同じ形で、`pointermove` のたびに書くと1回の移動で数十回 DB と監査ログを
 * 叩くうえ、取り直しと競り合う。
 *
 * したがって固定するのは2つ。**動かしている間は書かないこと**と、**離したときに
 * 最後の位置が必ず書かれること**（終わりが来ない経路があると、動かしたものが1つも
 * 保存されない）。
 */

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useElementMovement } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/interaction/useElementMovement"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { createMockAnnotation } from "./helpers/mockDrawingAPI"

/** 移動の受け口を、選択済み・ドラッグ中の状態で組み立てる */
function renderMovement(
  drawingElements: DrawingAnnotation[],
  selectedElementIds: string[] = drawingElements.map((element) => element.id)
) {
  const setDrawingElements = vi.fn()
  const updateDrawingElements = vi.fn()

  const { result, rerender } = renderHook(
    (props: { selectedElementIds: string[] }) =>
      useElementMovement({
        currentTool: "select",
        drawingElements,
        selectedElementIds: props.selectedElementIds,
        isDraggingElement: true,
        lineEditMode: null,
        isShiftPressed: false,
        setIsDraggingElement: vi.fn(),
        setDragElementOffset: vi.fn(),
        setLineEditMode: vi.fn(),
        setRectangleEditMode: vi.fn(),
        setDrawingElements,
        updateDrawingElements,
        hitTestElement: () => false,
      }),
    { initialProps: { selectedElementIds } }
  )

  return { result, rerender, setDrawingElements, updateDrawingElements }
}

describe("useElementMovement", () => {
  it("掴んでいる間は書かない（見た目だけが動く）", () => {
    const text = createMockAnnotation({
      id: "a1",
      type: "text",
      x: 0.5,
      y: 0.5,
    })
    const { result, setDrawingElements, updateDrawingElements } =
      renderMovement([text])

    act(() => {
      result.current.initializeMoveStart({ x: 0.1, y: 0.1 }, ["a1"])
      result.current.handleElementMovement({ x: 0.2, y: 0.2 })
      result.current.handleElementMovement({ x: 0.4, y: 0.3 })
    })

    expect(setDrawingElements).toHaveBeenCalled()
    expect(updateDrawingElements).not.toHaveBeenCalled()
  })

  it("離したときに最後の位置を1回で書く", () => {
    const text = createMockAnnotation({
      id: "a1",
      type: "text",
      x: 0.5,
      y: 0.5,
    })
    const { result, updateDrawingElements } = renderMovement([text])

    act(() => {
      result.current.initializeMoveStart({ x: 0.1, y: 0.1 }, ["a1"])
      result.current.handleElementMovement({ x: 0.2, y: 0.2 })
      result.current.handleElementMovement({ x: 0.4, y: 0.3 })
      result.current.handleMovementEnd()
    })

    expect(updateDrawingElements).toHaveBeenCalledTimes(1)
    expect(updateDrawingElements).toHaveBeenCalledWith([
      {
        id: "a1",
        // 開始位置 + 掴んだ点からの差分（0.5+0.3 / 0.5+0.2）
        updates: expect.objectContaining({
          x: expect.closeTo(0.8, 5),
          y: expect.closeTo(0.7, 5),
          // テキストは表示位置も一緒に動く
          displayX: expect.closeTo(0.3, 5),
          displayY: expect.closeTo(0.2, 5),
        }),
      },
    ])
  })

  it("複数選択で動かしたら、選んだ全てが同じ1回に入る", () => {
    const elements = [
      createMockAnnotation({ id: "a1", type: "rectangle", x: 0.1, y: 0.1 }),
      createMockAnnotation({ id: "a2", type: "rectangle", x: 0.3, y: 0.3 }),
    ]
    const { result, updateDrawingElements } = renderMovement(elements)

    act(() => {
      result.current.initializeMoveStart({ x: 0.5, y: 0.5 }, ["a1", "a2"])
      result.current.handleElementMovement({ x: 0.6, y: 0.5 })
      result.current.handleMovementEnd()
    })

    expect(updateDrawingElements).toHaveBeenCalledTimes(1)
    const [committed] = updateDrawingElements.mock.calls[0]
    expect(committed.map((commit: { id: string }) => commit.id)).toEqual([
      "a1",
      "a2",
    ])
  })

  it("動かしていなければ書かない（掴んで離しただけ）", () => {
    const text = createMockAnnotation({
      id: "a1",
      type: "text",
      x: 0.5,
      y: 0.5,
    })
    const { result, updateDrawingElements } = renderMovement([text])

    act(() => {
      result.current.initializeMoveStart({ x: 0.1, y: 0.1 }, ["a1"])
      result.current.handleMovementEnd()
    })

    expect(updateDrawingElements).not.toHaveBeenCalled()
  })

  it("掴んでいる間にツールが変わっても、動かした分は書ける", () => {
    // ツールが select 以外になると `handleSelectionMouseUp` は早期 return するので
    // `handleMovementEnd` まで来ない。その経路が呼ぶ口を用意しておく
    const text = createMockAnnotation({
      id: "a1",
      type: "text",
      x: 0.5,
      y: 0.5,
    })
    const { result, updateDrawingElements } = renderMovement([text])

    act(() => {
      result.current.initializeMoveStart({ x: 0.1, y: 0.1 }, ["a1"])
      result.current.handleElementMovement({ x: 0.4, y: 0.3 })
      result.current.flushPendingMoves()
    })

    expect(updateDrawingElements).toHaveBeenCalledTimes(1)
  })

  it("次の移動を始めたら、前の書き残しは持ち越さない", () => {
    const elements = [
      createMockAnnotation({ id: "a1", type: "text", x: 0.5, y: 0.5 }),
      createMockAnnotation({ id: "a2", type: "text", x: 0.2, y: 0.2 }),
    ]
    const { result, rerender, updateDrawingElements } = renderMovement(
      elements,
      ["a1"]
    )

    act(() => {
      // 1回目：動かしたが、終わりが来ないまま次の操作へ入る
      result.current.initializeMoveStart({ x: 0.1, y: 0.1 }, ["a1"])
      result.current.handleElementMovement({ x: 0.4, y: 0.3 })
    })

    // 2回目は別の要素を掴む
    rerender({ selectedElementIds: ["a2"] })

    act(() => {
      result.current.initializeMoveStart({ x: 0.1, y: 0.1 }, ["a2"])
      result.current.handleElementMovement({ x: 0.2, y: 0.1 })
      result.current.handleMovementEnd()
    })

    expect(updateDrawingElements).toHaveBeenCalledTimes(1)
    const [committed] = updateDrawingElements.mock.calls[0]
    expect(committed.map((commit: { id: string }) => commit.id)).toEqual(["a2"])
  })
})
