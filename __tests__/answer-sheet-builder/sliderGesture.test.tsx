// @vitest-environment jsdom
/**
 * つまみのジェスチャは「指で動かしている間」だけ。
 *
 * 保存はジェスチャが終わるまで待たされるので、**終わりが来ない経路があると以後の編集が
 * 一切保存されない**。矢印キーでの操作は1打鍵で値が確定する入力であって、ジェスチャでは
 * ない（Radix は制御コンポーネントだと `onValueCommit` を `onValueChange` より先に呼ぶ
 * ため、打鍵で始まりを立てると終わりが先に来て立ちっぱなしになる）。
 */

import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import {
  AsbGestureProvider,
  useAsbGestureOwner,
} from "@/components/answer-sheet-builder/AsbGestureContext"
import { SliderWithInput } from "@/components/answer-sheet-builder/components/form/SliderWithInput"

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

function Harness() {
  const { isGesturing, handlers } = useAsbGestureOwner()
  return (
    <AsbGestureProvider handlers={handlers}>
      <span data-testid="gesturing">{String(isGesturing)}</span>
      <SliderWithInput
        label="余白"
        value={10}
        min={0}
        max={20}
        step={1}
        onChange={() => {}}
      />
    </AsbGestureProvider>
  )
}

describe("つまみのジェスチャ", () => {
  it("矢印キーで動かしても、ジェスチャは始まらない（保存が止まらない）", () => {
    render(<Harness />)
    const thumb = screen.getByRole("slider")

    fireEvent.keyDown(thumb, { key: "ArrowRight" })

    expect(screen.getByTestId("gesturing").textContent).toBe("false")
  })

  it("指で押し下げたときは始まり、離したときに終わる", () => {
    render(<Harness />)
    const thumb = screen.getByRole("slider")

    fireEvent.pointerDown(thumb)
    expect(screen.getByTestId("gesturing").textContent).toBe("true")

    // 画面の外で離しても取り残されない（最後の砦の window リスナ）
    fireEvent.pointerUp(window)
    expect(screen.getByTestId("gesturing").textContent).toBe("false")
  })
})
