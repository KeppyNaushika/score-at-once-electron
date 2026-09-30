// @vitest-environment jsdom
/**
 * 窓を閉じてフォーカスがボタンへ戻っただけでは、そのボタンの Tooltip を開かない。
 *
 * Dialog などは閉じるとフォーカスを開いたボタンへ戻す。Radix の Tooltip は
 * フォーカスで開くので、何もしなければ窓を閉じるたびに Tooltip が出る。
 * 一方で、Tab で移ってきたときは開かないと、キーボードではボタンの意味が分からない。
 *
 * jsdom は `:focus-visible` を持たないが、`ui/tooltip.tsx` はそれに頼らず、
 * 直前の入力がフォーカスを動かすキーだったかで見分けるので、ここで確かめられる。
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Tooltip の矢印は ResizeObserver で大きさを測る。jsdom には無い
global.ResizeObserver = class implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function IconButtonWithDialog() {
  return (
    <>
      <input aria-label="前の欄" />
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button aria-label="設定を開く">⚙</Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>設定</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>設定の窓</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  )
}

afterEach(cleanup)

describe("窓から戻ったフォーカスでは Tooltip を開かない", () => {
  it("Tab で移ってきたときは開く", async () => {
    const user = userEvent.setup()
    render(<IconButtonWithDialog />)

    await user.click(screen.getByRole("textbox", { name: "前の欄" }))
    await user.tab()

    expect(screen.getByRole("button", { name: "設定を開く" })).toHaveFocus()
    expect(await screen.findByRole("tooltip")).toHaveTextContent("設定")
  })

  it("マウスで開いた Dialog を Esc で閉じても開かない", async () => {
    // 開いた Dialog は body の pointer-events を止めるので、その検査を外す
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<IconButtonWithDialog />)
    const trigger = screen.getByRole("button", { name: "設定を開く" })

    await user.click(trigger)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("キーボードで開いた Dialog を Esc で閉じても開かない", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<IconButtonWithDialog />)
    const trigger = screen.getByRole("button", { name: "設定を開く" })

    await user.click(screen.getByRole("textbox", { name: "前の欄" }))
    await user.tab()
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })
})
