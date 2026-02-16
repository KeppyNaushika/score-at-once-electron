/**
 * useImportWizard の戻り値をモック化するヘルパー
 *
 * コンポーネントテストで wizard prop を差し替えるために使用
 */

import { vi } from "vitest"

import { initialState } from "@/hooks/import/constants"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type { ImportWizardState } from "@/types/projectArchive.types"

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
    updateIdIntegrationConfig: vi.fn(),
    updateIdIntegrationDecision: vi.fn(),
    batchUpdateIdIntegrationDecisions: vi.fn(),
    updateMatchingConfig: vi.fn(),
    performMatching: vi.fn().mockResolvedValue(undefined),
    setMatchingDecision: vi.fn(),
    setAllMatchingDecisions: vi.fn(),
    setFieldUpdateDecision: vi.fn(),
    setBulkUpdateStrategy: vi.fn(),
    setScoringConflictStrategy: vi.fn(),
    setScoringConflictResolution: vi.fn(),
    setAllScoringConflictResolutions: vi.fn(),
    goToNextStep: vi.fn(),
    goBack: vi.fn(),
    executeImport: vi.fn().mockResolvedValue({
      success: true,
      projectId: "mock-project-id",
      summary: {
        created: {
          students: 1,
          classes: 0,
          users: 0,
          pages: 0,
          regions: 0,
          scores: 4,
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
          students: 2,
          classes: 0,
          users: 0,
          pages: 0,
          regions: 0,
          scores: 8,
          annotations: 0,
          subtotalGroups: 0,
          masterImages: 0,
          answerSheetImages: 0,
        },
      },
      warnings: [],
    }),
    reset: vi.fn(),
    clearError: vi.fn(),
  }
}
