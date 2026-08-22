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
    // 採点者は利用者名で結び付けるのが既定。id が一致すれば照合で先に片付くので、
    // ここが効くのは別のパソコンから持ってきたときだけ
    user: { strategy: "by_username", decisions: [] },
    // 試験IDが一致したときの既定。同じ試験の続きを取り込むのが普通なので「統合する」を
    // 初期選択にし、「上書きする」「別で追加する」は file_overview で選び直す
    exam: "merge",
  },
  isProcessing: false,
  error: null,
  sourceFormat: undefined,
  showHszDisclaimer: false,
  hszOriginalPath: undefined,
  hszOriginalTitle: undefined,
}

/**
 * ステップの順序
 * file_select → file_overview → id_integration → final_confirm → execute
 *
 * かつて id_integration と final_confirm の間にあった update_confirm（項目ごとに
 * 「このPC／ファイル／新しい方」を選ぶ段）は畳んだ。値の扱いは file_overview で
 * 選ぶ1つの方針に一本化され、何が書き換わるかは final_confirm が読み取り専用で見せる。
 */
export const STEP_ORDER: ImportWizardStep[] = [
  "file_select",
  "file_overview",
  "id_integration",
  "final_confirm",
  "execute",
]
