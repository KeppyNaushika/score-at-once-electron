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

/**
 * モック化された UseImportWizardReturn を作成する
 */
export function createMockWizard(
  stateOverrides?: Partial<ImportWizardState>
): UseImportWizardReturn {
  return {
    state: { ...initialState, ...stateOverrides },
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
      .mockResolvedValue({
        examId: "mock-exam-id",
        summary: createMockImportSummary(),
        warnings: [],
      }),
    reset: vi.fn(),
    clearError: vi.fn(),
  }
}
