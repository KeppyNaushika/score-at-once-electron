import {
  BarChart3,
  Calculator,
  Database,
  Edit,
  FileImage,
  FileOutput,
  Gavel,
  GitCompareArrows,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  type LucideIcon,
  PencilLine,
  Settings,
  SlidersHorizontal,
  Upload,
  Users,
} from "lucide-react"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import {
  answerSheetBuilderWorkflowSteps,
  courseworkWorkflowSteps,
  examWorkflowSteps,
  gradeWorkflowSteps,
  type WorkflowStep,
} from "@/lib/shared/workflowSteps"

/**
 * 段の一覧（`src/lib/shared/workflowSteps.ts`）に、概要の段カードの行頭に出す
 * アイコンを添えたタブ。段の名前と URL はここに持たない。
 */
function withIcons<StepId extends string>(
  steps: readonly (WorkflowStep & { id: StepId })[],
  icons: Record<StepId, LucideIcon>
): readonly WorkflowTab[] {
  return steps.map((step) => ({ ...step, icon: icons[step.id] }))
}

export const examWorkflowTabs = withIcons(examWorkflowSteps, {
  detail: LayoutDashboard,
  "01-upload": FileImage,
  "02-template": Settings,
  "03-region-info": Edit,
  "04-question-group": Calculator,
  "05-students": Users,
  "06-student-answers": Upload,
  "07-score-at-once": BarChart3,
  "08-finalize": Gavel,
  "09-export": FileOutput,
})

export const gradeWorkflowTabs = withIcons(gradeWorkflowSteps, {
  detail: LayoutDashboard,
  "01-students": Users,
  "02-data-sources": Database,
  "03-boundaries": SlidersHorizontal,
  "04-comparisons": GitCompareArrows,
  "05-results": BarChart3,
  "06-export": FileOutput,
})

export const courseworkWorkflowTabs = withIcons(courseworkWorkflowSteps, {
  detail: LayoutDashboard,
  "02-students": Users,
  "03-items": ListChecks,
  "04-scores": PencilLine,
  "05-results": BarChart3,
})

export const answerSheetBuilderWorkflowTabs = withIcons(
  answerSheetBuilderWorkflowSteps,
  {
    detail: LayoutDashboard,
    "01-edit": LayoutTemplate,
    "02-export": FileOutput,
  }
)

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
    stepIds: ["01-students", "02-data-sources"],
  },
  {
    title: "算出",
    description: "評定を分ける境目と、結果に並べる比較の設定",
    stepIds: ["03-boundaries", "04-comparisons"],
  },
  {
    title: "出力",
    description: "成績の確認と書き出し",
    stepIds: ["05-results", "06-export"],
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
