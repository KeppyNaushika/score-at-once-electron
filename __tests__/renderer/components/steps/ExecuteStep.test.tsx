// @vitest-environment jsdom
/**
 * ExecuteStep コンポーネントのテスト
 *
 * 実行の段は、ウィザードの `importOutcome`（実行の段の結果）で出し分ける。
 * ウィザード全体のエラー（`state.error`。上部の帯）は見ない。
 */

// setup.ts を適用
import "../../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ExecuteStep } from "@/components/import/steps/ExecuteStep"

import { createMockImportSummary } from "../../helpers/mockData"
import {
  createMockImportOutcome,
  createMockWizard,
} from "../../helpers/mockWizard"

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

  it("EX-2: 結果が出るまでは実行中、出たら完了を表示する", () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <ExecuteStep wizard={createMockWizard()} onClose={onClose} />
    )

    expect(screen.getByText("取り込み中...")).toBeInTheDocument()

    rerender(
      <ExecuteStep
        wizard={createMockWizard({}, createMockImportOutcome())}
        onClose={onClose}
      />
    )

    expect(screen.getByText("取り込みが完了しました")).toBeInTheDocument()
  })

  it("EX-5: 失敗の理由は実行の段の結果から出す（ウィザードのエラーは見ない）", () => {
    const wizard = createMockWizard(
      { error: "帯に出ている別のエラー" },
      { kind: "failed", error: "DB接続エラー" }
    )

    render(<ExecuteStep wizard={wizard} onClose={vi.fn()} />)

    expect(screen.getByText("取り込みに失敗しました")).toBeInTheDocument()
    expect(screen.getByText("DB接続エラー")).toBeInTheDocument()
    expect(screen.queryByText("帯に出ている別のエラー")).not.toBeInTheDocument()
  })

  it("EX-5b: ウィザードのエラーが消えても（帯の ✕）、失敗の表示は実行中に戻らない", () => {
    const failed = { kind: "failed", error: "DB接続エラー" } as const
    const { rerender } = render(
      <ExecuteStep
        wizard={createMockWizard({ error: "DB接続エラー" }, failed)}
        onClose={vi.fn()}
      />
    )

    rerender(
      <ExecuteStep
        wizard={createMockWizard({ error: null }, failed)}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText("取り込みに失敗しました")).toBeInTheDocument()
    expect(screen.queryByText("取り込み中...")).not.toBeInTheDocument()
  })

  it("EX-6: 試験を開くボタンでonCompleteとonCloseが呼ばれる", async () => {
    const user = userEvent.setup()
    const wizard = createMockWizard({}, createMockImportOutcome())
    const onComplete = vi.fn()
    const onClose = vi.fn()

    render(
      <ExecuteStep wizard={wizard} onComplete={onComplete} onClose={onClose} />
    )

    await user.click(screen.getByRole("button", { name: /試験を開く/ }))

    expect(onComplete).toHaveBeenCalledWith("mock-exam-id")
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("EX-7: 採点だけでなく、生徒・学級などの件数も出す（1件も無い種類は出さない）", () => {
    const summary = createMockImportSummary()
    const wizard = createMockWizard(
      {},
      {
        kind: "ok",
        result: {
          examId: "mock-exam-id",
          summary: {
            ...summary,
            // 注釈はどの区分も0件にする
            created: { ...summary.created, annotations: 0 },
            updated: { ...summary.updated, annotations: 0 },
            unchanged: { ...summary.unchanged, annotations: 0 },
            skipped: { ...summary.skipped, annotations: 0 },
          },
          warnings: [],
        },
      }
    )

    render(<ExecuteStep wizard={wizard} onClose={vi.fn()} />)

    const studentRow = screen.getByRole("row", { name: /生徒/ })
    // 新規追加・上書き・変更なし・スキップ（createMockImportSummary: 新規1・変更なし2）
    expect(
      within(studentRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual(["1", "0", "2", "0"])
    expect(screen.getByRole("rowheader", { name: "学級" })).toBeInTheDocument()
    expect(screen.getByRole("rowheader", { name: "採点" })).toBeInTheDocument()
    expect(
      screen.queryByRole("rowheader", { name: "注釈" })
    ).not.toBeInTheDocument()
  })

  it("EX-8: 同じ文の警告が複数あっても、すべて出す", () => {
    const outcome = createMockImportOutcome()
    if (outcome.kind !== "ok") throw new Error("成功の結果を作れなかった")
    const wizard = createMockWizard(
      {},
      {
        kind: "ok",
        result: {
          ...outcome.result,
          warnings: ["同じ警告", "同じ警告", "別の警告"],
        },
      }
    )

    render(<ExecuteStep wizard={wizard} onClose={vi.fn()} />)

    expect(screen.getAllByText("同じ警告")).toHaveLength(2)
    expect(screen.getByText("別の警告")).toBeInTheDocument()
  })
})
