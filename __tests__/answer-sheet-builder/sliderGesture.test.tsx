// @vitest-environment jsdom
/**
 * つまみのジェスチャは「指で動かしている間」だけ。
 *
 * ジェスチャの間、書き込みは待たされる。**終わりが来ない経路があると以後の編集が一切
 * 保存されない**ので、始まりを立てる条件と、終わりの砦（window の `pointerup`）を固定する。
 * 矢印キーでの操作は1打鍵で値が確定する入力であってジェスチャではない（Radix は制御
 * コンポーネントだと `onValueCommit` を `onValueChange` より先に呼ぶため、打鍵で始まりを
 * 立てると終わりが先に来て立ちっぱなしになる）。
 */

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { AsbGestureProvider } from "@/components/answer-sheet-builder/AsbGestureContext"
import { SliderWithInput } from "@/components/answer-sheet-builder/components/form/SliderWithInput"
import { useAsbWriteGate } from "@/components/answer-sheet-builder/hooks/useAsbWriteGate"
import type { AnswerSheetEditAction } from "@/types/answerSheetDefinition.types"

// jsdom に無いものを補う（Radix のつまみは大きさとポインタ捕捉を使う）
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
})

/** 動かした値を「小問の高さを書く意図」に見立てる */
function heightEdit(heightMultiplier: number): AnswerSheetEditAction {
  return {
    type: "UPDATE_SUB_QUESTION",
    payload: {
      subQuestionId: "sub-1",
      attributes: { label: "(1)", points: 1, heightMultiplier },
    },
  }
}

function Harness({ written }: { written: AnswerSheetEditAction[] }) {
  const { onEdit, gestureHandlers } = useAsbWriteGate((action) =>
    written.push(action)
  )
  return (
    <AsbGestureProvider handlers={gestureHandlers}>
      <SliderWithInput
        label="高さ"
        value={10}
        min={0}
        max={20}
        step={1}
        onChange={(value) => onEdit(heightEdit(value))}
      />
    </AsbGestureProvider>
  )
}

describe("つまみのジェスチャ", () => {
  it("矢印キーで動かすと、その場で書かれる（ジェスチャは始まらない）", () => {
    const written: AnswerSheetEditAction[] = []
    render(<Harness written={written} />)
    const thumb = screen.getByRole("slider")

    fireEvent.keyDown(thumb, { key: "ArrowRight" })

    expect(written).toHaveLength(1)
  })

  it("押し下げでジェスチャが始まる（離すまで待たされる）", () => {
    const written: AnswerSheetEditAction[] = []
    render(<Harness written={written} />)
    const thumb = screen.getByRole("slider")

    // 押し下げただけでは何も書かない。Radix は制御コンポーネントだと打鍵で
    // `onValueCommit`（＝ジェスチャの終わり）を先に呼ぶので、ここで打鍵は混ぜない
    fireEvent.pointerDown(thumb)
    expect(written).toHaveLength(0)
  })
})

describe("書き込みの関所", () => {
  it("ジェスチャの間は溜め、終わりで同じ対象の最後の1つだけを書く", () => {
    const written: AnswerSheetEditAction[] = []
    const { result } = renderHook(() =>
      useAsbWriteGate((action) => written.push(action))
    )

    act(() => {
      result.current.gestureHandlers.begin()
      result.current.onEdit(heightEdit(11))
      result.current.onEdit(heightEdit(12))
      result.current.onEdit(heightEdit(13))
    })
    expect(written).toHaveLength(0)

    act(() => {
      result.current.gestureHandlers.end()
    })

    expect(written).toHaveLength(1)
    const [edit] = written
    if (edit.type !== "UPDATE_SUB_QUESTION") throw new Error("種類が違う")
    expect(edit.payload.attributes.heightMultiplier).toBe(13)
  })

  it("ジェスチャの外では、そのまま1つずつ書く", () => {
    const written: AnswerSheetEditAction[] = []
    const { result } = renderHook(() =>
      useAsbWriteGate((action) => written.push(action))
    )

    act(() => {
      result.current.onEdit(heightEdit(11))
      result.current.onEdit(heightEdit(12))
    })

    expect(written).toHaveLength(2)
  })

  it("ジェスチャの途中でも、足す・消すは溜めずに書く", () => {
    // 溜めてよいのは「同じ対象を動かし続ける更新」だけ。知らない action を溜める側に
    // 倒すと、鍵が同じになった別の対象を取りこぼす
    const written: AnswerSheetEditAction[] = []
    const { result } = renderHook(() =>
      useAsbWriteGate((action) => written.push(action))
    )

    act(() => {
      result.current.gestureHandlers.begin()
      result.current.onEdit({
        type: "DELETE_SUB_QUESTION",
        payload: { subQuestionId: "sub-1" },
      })
    })

    expect(written).toHaveLength(1)
  })

  it("画面の外で指を離しても、溜めたままにならない", () => {
    const written: AnswerSheetEditAction[] = []
    const { result } = renderHook(() =>
      useAsbWriteGate((action) => written.push(action))
    )

    act(() => {
      result.current.gestureHandlers.begin()
      result.current.onEdit(heightEdit(11))
    })
    act(() => {
      fireEvent.pointerUp(window)
    })

    expect(written).toHaveLength(1)
  })
})
