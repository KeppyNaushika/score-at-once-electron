/**
 * インポートウィザードの定数
 */

import type {
  ImportWizardState,
  ImportWizardStep,
} from "@/types/examArchive.types"

/**
 * インポートウィザードの初期状態
 */
export const initialState: ImportWizardState = {
  currentStep: "file_select",
  archivePath: null,
  manifest: null,
  fileOverviewData: null,
  idIntegrationConfig: {
    student: { strategy: "by_student_number", decisions: [] },
    classroom: { strategy: "by_name", decisions: [] },
    subtotalGroup: { strategy: "by_name", decisions: [] },
  },
  scoringConflictConfig: {
    strategy: "newer_wins",
    manualResolutions: {},
  },
  isProcessing: false,
  error: null,
  updateDecisions: {},
  sourceFormat: undefined,
  showHszDisclaimer: false,
  hszOriginalPath: undefined,
  hszOriginalTitle: undefined,
}

/**
 * ステップの順序
 * file_select → file_overview → id_integration → update_confirm → final_confirm → execute
 */
export const STEP_ORDER: ImportWizardStep[] = [
  "file_select",
  "file_overview",
  "id_integration",
  "update_confirm",
  "final_confirm",
  "execute",
]
