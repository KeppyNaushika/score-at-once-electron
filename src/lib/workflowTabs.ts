import {
  BarChart3,
  Calculator,
  Database,
  Edit,
  FileImage,
  FileOutput,
  Gavel,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  PencilLine,
  Settings,
  SlidersHorizontal,
  Upload,
  Users,
} from "lucide-react"

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
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    icon: LayoutDashboard,
    path: "",
  },
  {
    id: "01-upload",
    label: "1. 模範解答",
    title: "模範解答画像の管理",
    description: "試験問題の模範解答画像を取り込む",
    icon: FileImage,
    path: "/01-upload",
  },
  {
    id: "02-template",
    label: "2. 採点領域",
    title: "答案の採点領域作成",
    description: "各設問の採点範囲を枠で囲んで決める",
    icon: Settings,
    path: "/02-template",
  },
  {
    id: "03-region-info",
    label: "3. 領域情報",
    title: "採点領域の詳細情報設定",
    description: "各領域の種類・配点・ラベルを決める",
    icon: Edit,
    path: "/03-region-info",
  },
  {
    id: "04-question-group",
    label: "4. 小計点",
    title: "小計点の設定",
    description: "設問をまとめて小計点を出す",
    icon: Calculator,
    path: "/04-question-group",
  },
  {
    id: "05-students",
    label: "5. 受験生徒",
    title: "受験生徒の管理",
    description: "この試験を受ける生徒を決める",
    icon: Users,
    path: "/05-students",
  },
  {
    id: "06-student-answers",
    label: "6. 生徒答案",
    title: "生徒答案の追加と関連付け",
    description: "スキャンした答案画像を取り込み、生徒に結び付ける",
    icon: Upload,
    path: "/06-student-answers",
  },
  {
    id: "07-score-at-once",
    label: "7. 採点",
    title: "一括採点",
    description: "キーボード中心の画面で答案を採点する",
    icon: BarChart3,
    path: "/07-score-at-once",
  },
  {
    id: "08-finalize",
    label: "8. 採点確定",
    title: "採点の割り当てと確定",
    description: "設問ごとの担当を割り当て、食い違いを裁定する",
    icon: Gavel,
    path: "/08-finalize",
  },
  {
    id: "09-export",
    label: "9. 結果",
    title: "採点結果のファイル出力",
    description: "採点結果を Excel・PDF で書き出す",
    icon: FileOutput,
    path: "/09-export",
  },
]

/** 成績算出の段（`01-setup` は概要へ畳まれているのでフォルダごと無い） */
export const gradeWorkflowTabs: readonly WorkflowTab[] = [
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    icon: LayoutDashboard,
    path: "",
  },
  {
    id: "02-students",
    label: "1. 生徒管理",
    title: "生徒の登録",
    description: "成績を出す生徒を決める",
    icon: Users,
    path: "/02-students",
  },
  {
    id: "03-data-sources",
    label: "2. データソース",
    title: "データソースの設定",
    description: "評価項目ごとに、点数の元になる試験や資料を選ぶ",
    icon: Database,
    path: "/03-data-sources",
  },
  {
    id: "04-manual-scores",
    label: "3. 外部成績",
    title: "外部成績の入力",
    description: "試験にも資料にも無い点数を手で入れる",
    icon: PencilLine,
    path: "/04-manual-scores",
  },
  {
    id: "05-boundaries",
    label: "4. 成績境界",
    title: "成績境界の設定",
    description: "評定を分ける境目を決める",
    icon: SlidersHorizontal,
    path: "/05-boundaries",
  },
  {
    id: "06-results",
    label: "5. 結果",
    title: "成績の確認",
    description: "算出された成績を一覧で確かめる",
    icon: BarChart3,
    path: "/06-results",
  },
  {
    id: "07-export",
    label: "6. 出力",
    title: "結果の出力",
    description: "成績を Excel・PDF で書き出す",
    icon: FileOutput,
    path: "/07-export",
  },
]

/** 試験外成績資料の段 */
export const courseworkWorkflowTabs: readonly WorkflowTab[] = [
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    icon: LayoutDashboard,
    path: "",
  },
  {
    id: "02-students",
    label: "1. 生徒管理",
    title: "生徒の登録",
    description: "この資料の対象になる生徒を決める",
    icon: Users,
    path: "/02-students",
  },
  {
    id: "03-items",
    label: "2. 評価項目",
    title: "評価項目の設定",
    description: "点数を付ける項目と満点を決める",
    icon: ListChecks,
    path: "/03-items",
  },
  {
    id: "04-scores",
    label: "3. 点数入力",
    title: "点数の入力",
    description: "生徒ごとに点数を入れる",
    icon: PencilLine,
    path: "/04-scores",
  },
  {
    id: "05-results",
    label: "4. 結果",
    title: "結果の確認",
    description: "入力した点数を一覧で確かめる",
    icon: BarChart3,
    path: "/05-results",
  },
]

/** 解答用紙作成の段 */
export const answerSheetBuilderWorkflowTabs: readonly WorkflowTab[] = [
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    icon: LayoutDashboard,
    path: "",
  },
  {
    id: "01-edit",
    label: "1. 作成",
    title: "解答用紙の作成",
    description: "解答欄を並べて用紙を組み立てる",
    icon: LayoutTemplate,
    path: "/01-edit",
  },
  {
    id: "02-export",
    label: "2. 書き出し",
    title: "解答用紙の書き出し",
    description: "組んだ用紙を PDF で書き出す",
    icon: FileOutput,
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
 *
 * **「着手できるか」もここには無い。** 以前は段ごとに `dependsOn` を手で書いて
 * いたが、`stepIds` は既に**やる順そのもの**なので「それより前の段が全部済んで
 * いれば着手できる」と導ける（`EntityOverviewPage` の段カード）。前後関係を2度書けば、
 * 段を挟んだときに片方だけ古くなる。
 */
export interface WorkflowPhaseGroup {
  /** まとまりの名前（準備 / 採点 / 出力） */
  title: string
  /** 見出しに添える一文（このまとまりで何をするか） */
  description: string
  /** このまとまりに属する段の id（`WorkflowTab.id`。並べる順そのもの） */
  stepIds: readonly string[]
}

/**
 * 試験の段カード。
 *
 * **「8. 採点確定」は採点のまとまりに入る。** 確定は採点の一部であって別の仕事では
 * ない（採点者が複数いて食い違ったときに、どれを採るか決める段）。済んだかどうかも
 * 他の段と同じく `getExamProgress` が言う（`hasFinalizedScores`）—— 裁定の要るマスが
 * 残っていなければ済み。採点者が1人なら食い違いが構造的に起きないので常に済みになり、
 * 「一生満たされない条件」で足が止まることはない。
 */
export const examWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  {
    title: "準備",
    description: "試験を実施する前の設定",
    stepIds: [
      "01-upload",
      "02-template",
      "03-region-info",
      "04-question-group",
      "05-students",
    ],
  },
  {
    title: "採点",
    description: "答案の取り込みから採点・確定まで",
    stepIds: ["06-student-answers", "07-score-at-once", "08-finalize"],
  },
  {
    title: "出力",
    description: "採点結果の書き出し",
    stepIds: ["09-export"],
  },
]

/** 成績算出の段カード */
export const gradeWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  {
    title: "準備",
    description: "生徒と、点数の元になるデータの設定",
    stepIds: ["02-students", "03-data-sources"],
  },
  {
    title: "算出",
    description: "点数の入力と、評定を分ける境目の設定",
    stepIds: ["04-manual-scores", "05-boundaries"],
  },
  {
    title: "出力",
    description: "成績の確認と書き出し",
    stepIds: ["06-results", "07-export"],
  },
]

/** 試験外成績資料の段カード */
export const courseworkWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  {
    title: "準備",
    description: "生徒と評価項目の設定",
    stepIds: ["02-students", "03-items"],
  },
  {
    title: "入力",
    description: "生徒ごとの点数入力",
    stepIds: ["04-scores"],
  },
  {
    title: "結果",
    description: "入力した点数の確認",
    stepIds: ["05-results"],
  },
]

/** 解答用紙作成の段カード */
export const answerSheetBuilderWorkflowPhases: readonly WorkflowPhaseGroup[] = [
  {
    title: "作成",
    description: "解答用紙の組み立て",
    stepIds: ["01-edit"],
  },
  {
    title: "書き出し",
    description: "PDF への書き出し",
    stepIds: ["02-export"],
  },
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
