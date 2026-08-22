// @vitest-environment jsdom
/**
 * ImportWizardModal コンポーネントのテスト
 */

// setup.ts を適用
import "../setup"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ImportWizardModal } from "@/components/import/ImportWizardModal"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import { useImportWizard } from "@/hooks/import/useImportWizard"

import { createMockWizard } from "../helpers/mockWizard"

// useImportWizard をモック
vi.mock("@/hooks/import/useImportWizard", () => ({
  useImportWizard: vi.fn(),
}))

// 関門（AuthGate）の内側なので、利用者は必ず居る
vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: vi.fn(() => ({
    id: "test-user-id",
    username: "testuser",
    name: "テストユーザー",
    role: "admin",
  })),
}))

const mockUseImportWizard = vi.mocked(useImportWizard)

describe("ImportWizardModal", () => {
  let mockWizard: UseImportWizardReturn

  beforeEach(() => {
    mockWizard = createMockWizard()
    mockUseImportWizard.mockReturnValue(mockWizard)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("IM-1: モーダルが開くとfile_selectステップが表示される", () => {
    render(<ImportWizardModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText("試験インポート")).toBeInTheDocument()
    expect(screen.getByText("試験アーカイブを選択")).toBeInTheDocument()
  })

  it("IM-2: 戻るボタンがfile_selectで無効化される", () => {
    render(<ImportWizardModal isOpen={true} onClose={vi.fn()} />)

    const backButton = screen.getByRole("button", { name: /戻る/ })
    expect(backButton).toBeDisabled()
  })

  it("IM-3: 処理中はキャンセルボタンが無効化される", () => {
    mockWizard = createMockWizard({ isProcessing: true })
    mockUseImportWizard.mockReturnValue(mockWizard)

    render(<ImportWizardModal isOpen={true} onClose={vi.fn()} />)

    const cancelButton = screen.getByRole("button", { name: /キャンセル/ })
    expect(cancelButton).toBeDisabled()
  })

  it("IM-4: 処理中に戻るボタンが無効化される", () => {
    mockWizard = createMockWizard({
      isProcessing: true,
      currentStep: "file_overview",
    })
    mockUseImportWizard.mockReturnValue(mockWizard)

    render(<ImportWizardModal isOpen={true} onClose={vi.fn()} />)

    const backButton = screen.getByRole("button", { name: /戻る/ })
    expect(backButton).toBeDisabled()
  })

  it("IM-5: エラー表示時にエラーメッセージが表示される", () => {
    mockWizard = createMockWizard({ error: "テストエラーメッセージ" })
    mockUseImportWizard.mockReturnValue(mockWizard)

    render(<ImportWizardModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText("テストエラーメッセージ")).toBeInTheDocument()
    expect(screen.getByText("エラー")).toBeInTheDocument()
  })

  it("IM-6: ステップインジケーターが全ステップを表示する（「更新」の段は無い）", () => {
    render(<ImportWizardModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText("ファイル選択")).toBeInTheDocument()
    expect(screen.getByText("内容確認")).toBeInTheDocument()
    expect(screen.getByText("紐づけ")).toBeInTheDocument()
    expect(screen.getByText("確認")).toBeInTheDocument()
    expect(screen.getByText("実行")).toBeInTheDocument()
    // 項目ごとに更新方法を選ぶ段は畳んだ（値の扱いは「内容確認」で選ぶ1つの方針で決まる）
    expect(screen.queryByText("更新")).not.toBeInTheDocument()
  })

  it("IM-7: キャンセルボタンクリックでonCloseが呼ばれる", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<ImportWizardModal isOpen={true} onClose={onClose} />)

    await user.click(screen.getByRole("button", { name: /キャンセル/ }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it("IM-8: 処理中にキャンセルボタンクリックでonCloseが呼ばれない", async () => {
    userEvent.setup()
    const onClose = vi.fn()
    mockWizard = createMockWizard({ isProcessing: true })
    mockUseImportWizard.mockReturnValue(mockWizard)

    render(<ImportWizardModal isOpen={true} onClose={onClose} />)

    const cancelButton = screen.getByRole("button", { name: /キャンセル/ })
    // disabled なのでクリックしても何も起きない
    expect(cancelButton).toBeDisabled()
  })
})
