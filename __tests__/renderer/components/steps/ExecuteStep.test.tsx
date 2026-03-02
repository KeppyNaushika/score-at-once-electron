// @vitest-environment jsdom
/**
 * ExecuteStep コンポーネントのテスト
 */

// setup.ts を適用
import "../../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExecuteStep } from "@/components/import/steps/ExecuteStep"

import { createMockWizard } from "../../helpers/mockWizard"

describe("ExecuteStep", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("EX-1: マウント時にexecuteImportが自動実行される", async () => {
    const wizard = createMockWizard()
    const onClose = vi.fn()

    render(<ExecuteStep wizard={wizard} onClose={onClose} />)

    await waitFor(() => {
      expect(wizard.executeImport).toHaveBeenCalledOnce()
    })
  })

  it("EX-2: 実行中にプログレス表示がされる", async () => {
    let resolveImport: (value: unknown) => void
    const wizard = createMockWizard()
    wizard.executeImport = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve
      })
    )

    const onClose = vi.fn()
    render(<ExecuteStep wizard={wizard} onClose={onClose} />)

    expect(screen.getByText("インポート中...")).toBeInTheDocument()

    // resolveして完了させる
    resolveImport!({
      success: true,
      examId: "test",
      summary: {
        created: {
          students: 0,
          classes: 0,
          users: 0,
          pages: 0,
          regions: 0,
          scores: 0,
          annotations: 0,
          subtotalGroups: 0,
          masterImages: 0,
          answerSheetImages: 0,
        },
        updated: {
          students: 0,
          classes: 0,
          users: 0,
          pages: 0,
          regions: 0,
          scores: 0,
          annotations: 0,
          subtotalGroups: 0,
          masterImages: 0,
          answerSheetImages: 0,
        },
        skipped: {
          students: 0,
          classes: 0,
          users: 0,
          pages: 0,
          regions: 0,
          scores: 0,
          annotations: 0,
          subtotalGroups: 0,
          masterImages: 0,
          answerSheetImages: 0,
        },
        unchanged: {
          students: 0,
          classes: 0,
          users: 0,
          pages: 0,
          regions: 0,
          scores: 0,
          annotations: 0,
          subtotalGroups: 0,
          masterImages: 0,
          answerSheetImages: 0,
        },
      },
      warnings: [],
    })

    await waitFor(() => {
      expect(screen.getByText("インポートが完了しました")).toBeInTheDocument()
    })
  })

  it("EX-3: 成功時に完了メッセージが表示される", async () => {
    const wizard = createMockWizard()
    const onClose = vi.fn()

    render(<ExecuteStep wizard={wizard} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText("インポートが完了しました")).toBeInTheDocument()
    })
  })

  it("EX-4: 成功時に試験を開くボタンが表示される", async () => {
    const wizard = createMockWizard()
    const onClose = vi.fn()

    render(<ExecuteStep wizard={wizard} onClose={onClose} />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /試験を開く/ })
      ).toBeInTheDocument()
    })
  })

  it("EX-5: 失敗時にエラーメッセージが表示される", async () => {
    const wizard = createMockWizard()
    wizard.executeImport = vi.fn().mockResolvedValue({
      success: false,
      error: "インポートに失敗しました: DB接続エラー",
    })
    const onClose = vi.fn()

    render(<ExecuteStep wizard={wizard} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText("インポートに失敗しました")).toBeInTheDocument()
    })
  })

  it("EX-6: 試験を開くボタンでonCompleteとonCloseが呼ばれる", async () => {
    const user = userEvent.setup()
    const wizard = createMockWizard()
    const onComplete = vi.fn()
    const onClose = vi.fn()

    render(
      <ExecuteStep wizard={wizard} onComplete={onComplete} onClose={onClose} />
    )

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /試験を開く/ })
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /試験を開く/ }))

    expect(onComplete).toHaveBeenCalledWith("mock-exam-id")
    expect(onClose).toHaveBeenCalledOnce()
  })
})
