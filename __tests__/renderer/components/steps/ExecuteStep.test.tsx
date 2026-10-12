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
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"

import { createMockImportSummary } from "../../helpers/mockData"
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
    let resolveImport: (
      importResult: Awaited<ReturnType<UseImportWizardReturn["executeImport"]>>
    ) => void
    const wizard = createMockWizard()
    wizard.executeImport = vi
      .fn<UseImportWizardReturn["executeImport"]>()
      .mockReturnValue(
        new Promise((resolve) => {
          resolveImport = resolve
        })
      )

    const onClose = vi.fn()
    render(<ExecuteStep wizard={wizard} onClose={onClose} />)

    expect(screen.getByText("取り込み中...")).toBeInTheDocument()

    // resolveして完了させる
    resolveImport!({
      examId: "test",
      summary: createMockImportSummary(),
      warnings: [],
    })

    await waitFor(() => {
      expect(screen.getByText("取り込みが完了しました")).toBeInTheDocument()
    })
  })

  it("EX-5: 失敗時に state.error の文言が表示される", async () => {
    // 失敗時 executeImport は null を返し、文言は wizard の state.error に載る
    const wizard = createMockWizard()
    wizard.executeImport = vi
      .fn<UseImportWizardReturn["executeImport"]>()
      .mockResolvedValue(null)
    wizard.state = {
      ...wizard.state,
      error: "DB接続エラー",
    }
    const onClose = vi.fn()

    render(<ExecuteStep wizard={wizard} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText("取り込みに失敗しました")).toBeInTheDocument()
    })
    expect(screen.getByText("DB接続エラー")).toBeInTheDocument()
    expect(screen.queryByText("詳細は不明です")).not.toBeInTheDocument()
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
