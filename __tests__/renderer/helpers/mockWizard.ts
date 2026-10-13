/**
 * useImportWizard の戻り値をモック化するヘルパー
 *
 * コンポーネントテストで wizard prop を差し替えるために使用
 */

import { vi } from "vitest"

import { initialState } from "@/hooks/import/constants"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type { ImportWizardState } from "@/types/examArchive.types"

import { createMockImportSummary } from "./mockData"

/** 取り込めたときの実行の段の結果 */
export function createMockImportOutcome(): NonNullable<
  UseImportWizardReturn["importOutcome"]
> {
  return {
    kind: "ok",
    result: {
      examId: "mock-exam-id",
      summary: createMockImportSummary(),
      warnings: [],
    },
  }
}

/**
 * モック化された UseImportWizardReturn を作成する
 *
 * 実行の段の結果（`importOutcome`）は既定で null（実行中）。結果を見せるときは
 * `importOutcome` を差し替える（モックの executeImport は結果を書き込まない）
 */
export function createMockWizard(
  stateOverrides?: Partial<ImportWizardState>,
  importOutcome: UseImportWizardReturn["importOutcome"] = null
): UseImportWizardReturn {
  return {
    state: { ...initialState, ...stateOverrides },
    importOutcome,
    selectFile: vi.fn().mockResolvedValue(true),
    performPreMatching: vi.fn().mockResolvedValue(true),
    setImportAction: vi.fn(),
    updateIdIntegrationConfig: vi.fn(),
    updateIdIntegrationDecision: vi.fn(),
    batchUpdateIdIntegrationDecisions: vi.fn(),
    acceptHszDisclaimer: vi.fn().mockResolvedValue(true),
    dismissHszDisclaimer: vi.fn(),
    updateSubtotalMapping: vi.fn(),
    clearSubtotalMappings: vi.fn(),
    goToNextStep: vi.fn(),
    goBack: vi.fn(),
    executeImport: vi
      .fn<UseImportWizardReturn["executeImport"]>()
      .mockResolvedValue(createMockImportOutcome()),
    reset: vi.fn(),
    clearError: vi.fn(),
  }
}
