import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"

/**
 * 段のあるワークフロー4つ（試験・成績算出・試験外成績資料・解答用紙作成）の段の一覧。
 *
 * **写しを持たない。** ここに置く前は、各 `layout.tsx` が自分の配列を持ち、
 * `useNavigationHistory` が「対応する layout.tsx のステップ定義と揃える」という
 * コメント付きで**同じものを手で書き写した2つ目**を持っていた。写しは黙ってずれる
 * ——実際、成績の段は layout 側が「1. 生徒管理」「2. データソース」…と繰り上がって
 * いるのに、履歴側の写しは「1. 基本設定」「2. 生徒管理」…のまま古い番号を出していた。
 *
 * `id` は URL のフォルダ名そのもの（`src/app/(app)/<section>/[id]/<id>/`）。履歴の
 * ラベルは URL の第3セグメントをこの `id` で引くので、フォルダ名と一致していないと
 * 引けない。概要だけは実体そのもののURLなので `path` が空文字になる。
 */

/**
 * 試験の段。
 *
 * 8. 採点確定は**協調採点でだけ意味を持つ**段で、単独採点では裁定対象が構造的に
 * ゼロになる。それでもタブからは常に見せる ——「あるはずの段が状況によって消える」
 * 方が、開いて「対象なし」と分かるより読みにくい。
 */
export const examWorkflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", title: "概要", path: "" },
  {
    id: "01-upload",
    label: "1. 模範解答",
    title: "模範解答画像の管理",
    path: "/01-upload",
  },
  {
    id: "02-template",
    label: "2. 採点領域",
    title: "答案の採点領域作成",
    path: "/02-template",
  },
  {
    id: "03-region-info",
    label: "3. 領域情報",
    title: "採点領域の詳細情報設定",
    path: "/03-region-info",
  },
  {
    id: "04-question-group",
    label: "4. 小計点",
    title: "小計点の設定",
    path: "/04-question-group",
  },
  {
    id: "05-students",
    label: "5. 受験生徒",
    title: "受験生徒の管理",
    path: "/05-students",
  },
  {
    id: "06-student-answers",
    label: "6. 生徒答案",
    title: "生徒答案の追加と関連付け",
    path: "/06-student-answers",
  },
  {
    id: "07-score-at-once",
    label: "7. 採点",
    title: "一括採点",
    path: "/07-score-at-once",
  },
  {
    id: "08-finalize",
    label: "8. 採点確定",
    title: "採点の割り当てと確定",
    path: "/08-finalize",
  },
  {
    id: "09-export",
    label: "9. 結果",
    title: "採点結果のファイル出力",
    path: "/09-export",
  },
]

/** 成績算出の段（`01-setup` は概要へ畳まれているのでフォルダごと無い） */
export const gradeWorkflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", title: "概要", path: "" },
  {
    id: "02-students",
    label: "1. 生徒管理",
    title: "生徒の登録",
    path: "/02-students",
  },
  {
    id: "03-data-sources",
    label: "2. データソース",
    title: "データソースの設定",
    path: "/03-data-sources",
  },
  {
    id: "04-manual-scores",
    label: "3. 外部成績",
    title: "外部成績の入力",
    path: "/04-manual-scores",
  },
  {
    id: "05-boundaries",
    label: "4. 成績境界",
    title: "成績境界の設定",
    path: "/05-boundaries",
  },
  {
    id: "06-results",
    label: "5. 結果",
    title: "成績の確認",
    path: "/06-results",
  },
  {
    id: "07-export",
    label: "6. 出力",
    title: "結果の出力",
    path: "/07-export",
  },
]

/** 試験外成績資料の段 */
export const courseworkWorkflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", title: "概要", path: "" },
  {
    id: "02-students",
    label: "1. 生徒管理",
    title: "生徒の登録",
    path: "/02-students",
  },
  {
    id: "03-items",
    label: "2. 評価項目",
    title: "評価項目の設定",
    path: "/03-items",
  },
  {
    id: "04-scores",
    label: "3. 点数入力",
    title: "点数の入力",
    path: "/04-scores",
  },
  {
    id: "05-results",
    label: "4. 結果",
    title: "結果の確認",
    path: "/05-results",
  },
]

/** 解答用紙作成の段 */
export const answerSheetBuilderWorkflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", title: "概要", path: "" },
  {
    id: "01-edit",
    label: "1. 作成",
    title: "解答用紙の作成",
    path: "/01-edit",
  },
  {
    id: "02-export",
    label: "2. 書き出し",
    title: "解答用紙の書き出し",
    path: "/02-export",
  },
]

/**
 * 概要ページの段カード1枚が束ねる段。
 *
 * **段の名前も行き先もここには無い。** 持つのは「まとまりの名前」と「どの段が
 * 属するか」だけで、名前は `WorkflowTab.title`、行き先は `entityHref + path` から
 * 引く。概要のカードに段の名前を書き写すと、タブと概要で同じ段が違う名前で呼ばれる
 * （履歴側の写しが実際にずれていた）。
 */
export interface WorkflowPhaseGroup {
  /** まとまりの名前（準備 / 採点 / 確定 / 出力） */
  title: string
  /** このまとまりに属する段の id（`WorkflowTab.id`。並べる順そのもの） */
  stepIds: readonly string[]
}

/**
 * 試験の段カード。
 *
 * **「8. 採点確定」は自分のカードを持つ。** 中身の作り込みは無い（確定の機能は
 * 後で全面的に書き直す）が、**段が在ることは概要から見えていなければならない**。
 * ただし進み具合は出さない —— 確定が要るかどうかは採点者が複数いて食い違ったかで
 * 決まり、`ExamProgressSource` にその材料が無い。％のために梯子（`examStatus.ts`）へ
 * 段を足すと、単独採点の試験が一生満たされない条件で止まる。
 */
export const examWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  {
    title: "準備",
    stepIds: [
      "01-upload",
      "02-template",
      "03-region-info",
      "04-question-group",
      "05-students",
    ],
  },
  { title: "採点", stepIds: ["06-student-answers", "07-score-at-once"] },
  { title: "確定", stepIds: ["08-finalize"] },
  { title: "出力", stepIds: ["09-export"] },
]

/** 成績算出の段カード */
export const gradeWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  { title: "準備", stepIds: ["02-students", "03-data-sources"] },
  { title: "算出", stepIds: ["04-manual-scores", "05-boundaries"] },
  { title: "出力", stepIds: ["06-results", "07-export"] },
]

/** 試験外成績資料の段カード */
export const courseworkWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  { title: "準備", stepIds: ["02-students", "03-items"] },
  { title: "入力", stepIds: ["04-scores"] },
  { title: "結果", stepIds: ["05-results"] },
]

/** 解答用紙作成の段カード */
export const answerSheetBuilderWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  { title: "作成", stepIds: ["01-edit"] },
  { title: "書き出し", stepIds: ["02-export"] },
]

/**
 * URL のフォルダ名から段の表示名を引く（概要は段ではないので引かない）。
 * 引けなければ `undefined` ——履歴のラベルは段の名前を落として「試験｜期末考査」に戻る。
 */
export function findWorkflowStepLabel(
  tabs: readonly WorkflowTab[],
  stepFolderName: string | undefined
): string | undefined {
  if (!stepFolderName) return undefined
  return tabs.find((tab) => tab.path !== "" && tab.id === stepFolderName)?.label
}
