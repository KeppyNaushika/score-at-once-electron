// @vitest-environment jsdom
/**
 * FileOverviewStep コンポーネントのテスト
 */

// setup.ts を適用
import "../../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FileOverviewStep } from "@/components/import/steps/FileOverviewStep"

import {
  createMockFileOverviewData,
  createMockManifest,
} from "../../helpers/mockData"
import { createMockWizard } from "../../helpers/mockWizard"

describe("FileOverviewStep", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("FO-1: 試験名がmanifestから表示される", () => {
    const wizard = createMockWizard({
      manifest: createMockManifest({ examName: "期末テスト" }),
      fileOverviewData: createMockFileOverviewData(),
    })
    render(<FileOverviewStep wizard={wizard} />)

    expect(screen.getByText(/期末テスト/)).toBeInTheDocument()
  })

  it("FO-2: カテゴリ別統計が正しく表示される", () => {
    const wizard = createMockWizard({
      manifest: createMockManifest({
        counts: {
          students: 3,
          classes: 1,
          users: 1,
          pages: 2,
          regions: 4,
          scores: 12,
          annotations: 0,
          subtotalGroups: 1,
          masterImages: 2,
          answerSheetImages: 6,
        },
      }),
      fileOverviewData: createMockFileOverviewData(),
    })
    render(<FileOverviewStep wizard={wizard} />)

    expect(screen.getByText(/生徒: 3/)).toBeInTheDocument()
    expect(screen.getByText(/学級: 1/)).toBeInTheDocument()
    expect(screen.getByText(/小計グループ: 1/)).toBeInTheDocument()
  })

  it("FO-3: 自動紐づけ件数が正しく表示される", () => {
    const wizard = createMockWizard({
      manifest: createMockManifest(),
      fileOverviewData: createMockFileOverviewData(),
    })
    render(<FileOverviewStep wizard={wizard} />)

    // student: byId=2, class: byId=1, subtotalGroup: byId=1
    expect(screen.getByText(/自動で紐づく: 2/)).toBeInTheDocument()
  })

  it("FO-4: 判断が必要な件数が正しく表示される", () => {
    const wizard = createMockWizard({
      manifest: createMockManifest(),
      fileOverviewData: createMockFileOverviewData(),
    })
    render(<FileOverviewStep wizard={wizard} />)

    // student: noMatch=1
    expect(screen.getByText(/判断が必要: 1/)).toBeInTheDocument()
  })

  it("FO-5: 次へボタンクリックでgoToNextStepが呼ばれる", async () => {
    const user = userEvent.setup()
    const wizard = createMockWizard({
      manifest: createMockManifest(),
      fileOverviewData: createMockFileOverviewData(),
    })
    render(<FileOverviewStep wizard={wizard} />)

    await user.click(screen.getByRole("button", { name: "次へ" }))

    expect(wizard.goToNextStep).toHaveBeenCalledOnce()
  })

  it("FO-6: fileOverviewData未取得時にperformPreMatchingが呼ばれる", async () => {
    const user = userEvent.setup()
    const wizard = createMockWizard({
      manifest: createMockManifest(),
      fileOverviewData: null,
    })
    render(<FileOverviewStep wizard={wizard} />)

    await user.click(screen.getByRole("button", { name: "次へ" }))

    await waitFor(() => {
      expect(wizard.performPreMatching).toHaveBeenCalledOnce()
    })
    expect(wizard.goToNextStep).toHaveBeenCalledOnce()
  })

  it("FO-7: fileOverviewData未取得時にヘルプメッセージが表示される", () => {
    const wizard = createMockWizard({
      manifest: createMockManifest(),
      fileOverviewData: null,
    })
    render(<FileOverviewStep wizard={wizard} />)

    expect(
      screen.getByText(/「次へ」を押して照合を開始してください/)
    ).toBeInTheDocument()
  })
})
