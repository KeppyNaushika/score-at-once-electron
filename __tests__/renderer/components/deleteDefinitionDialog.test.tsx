// @vitest-environment jsdom
/**
 * 解答用紙の削除確認が、**削除を送っている間は押させない**ことの検証（#1491）。
 *
 * 以前は「削除」を押したあとも押せるままで、2回押すと削除の書き込みが2回送られた。
 * 成績算出・試験外成績資料と同じ確認の部品に寄せ、`loading` の間は両方のボタンを止める。
 * Esc でも閉じない（閉じると進み具合も失敗も見えなくなる）。
 */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DeleteDefinitionDialog } from "@/components/answer-sheet-builder/components/list/DeleteDefinitionDialog"

function renderDialog(
  loading: boolean,
  onConfirm = vi.fn(async () => {}),
  onClose = vi.fn()
) {
  render(
    <DeleteDefinitionDialog
      open
      onClose={onClose}
      definitionName="一学期中間"
      onConfirm={onConfirm}
      loading={loading}
    />
  )
  return onConfirm
}

const buttonNamed = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name })

describe("解答用紙の削除確認", () => {
  it("確認文は変えない", () => {
    renderDialog(false)
    expect(screen.getByText("解答用紙を削除しますか？")).toBeTruthy()
    expect(
      screen.getByText("「一学期中間」を削除します。この操作は元に戻すことができません。")
    ).toBeTruthy()
  })

  it("削除していない間は押せ、押すと削除を送る", async () => {
    const user = userEvent.setup()
    const onConfirm = renderDialog(false)
    await user.click(buttonNamed("削除する"))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("削除を送っている間は両方のボタンを止め、処理中と出す", async () => {
    const user = userEvent.setup()
    const onConfirm = renderDialog(true)
    const confirmButton = buttonNamed("処理中...")
    expect(confirmButton.disabled).toBe(true)
    expect(buttonNamed("キャンセル").disabled).toBe(true)
    await user.click(confirmButton)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("削除を送っている間は Esc でも閉じない", async () => {
    const user = userEvent.setup()
    const onCloseWhileDeleting = vi.fn()
    renderDialog(true, undefined, onCloseWhileDeleting)
    await user.keyboard("{Escape}")
    expect(onCloseWhileDeleting).not.toHaveBeenCalled()
  })

  it("削除していない間は Esc で閉じる", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderDialog(false, undefined, onClose)
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
