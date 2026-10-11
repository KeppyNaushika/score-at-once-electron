// @vitest-environment jsdom
/**
 * FileSelectStep コンポーネントのテスト
 */

// setup.ts を適用
import "../../setup"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FileSelectStep } from "@/components/import/steps/FileSelectStep"

import { createMockWizard } from "../../helpers/mockWizard"

describe("FileSelectStep", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("FS-1: ファイル選択ボタンが表示される", () => {
    const wizard = createMockWizard()
    render(<FileSelectStep wizard={wizard} />)

    expect(
      screen.getByRole("button", { name: /ファイルを選択/ })
    ).toBeInTheDocument()
  })

  it("FS-2: ボタンクリックでselectFileが呼ばれる", async () => {
    const user = userEvent.setup()
    const wizard = createMockWizard()
    render(<FileSelectStep wizard={wizard} />)

    await user.click(screen.getByRole("button", { name: /ファイルを選択/ }))

    expect(wizard.selectFile).toHaveBeenCalledOnce()
  })

  it("FS-3: 処理中はボタンが「読み込み中...」になり、押せない", () => {
    const wizard = createMockWizard({ isProcessing: true })
    render(<FileSelectStep wizard={wizard} />)

    const button = screen.getByRole("button", { name: /読み込み中\.\.\./ })
    expect(button).toBeDisabled()
  })
})
