/**
 * 段のあるワークフロー4つ（試験・成績算出・試験外成績資料・解答用紙作成）の段の一覧。
 *
 * **段の名前と URL の出どころはここ1か所だけ。** タブ・「次へ」・概要の段カード・
 * 履歴のラベル・一覧の「次のステップ」・main が返す断りの文言（「2. データソース」で
 * 外してください）は、どれもここから引く。写しは黙ってずれる ——実際、成績の段は
 * layout 側が「1. 生徒管理」「2. データソース」…と繰り上がっているのに、履歴側の
 * 写しは「1. 基本設定」「2. 生徒管理」…のまま古い番号を出していた。
 *
 * main からも読むので、画面の部品（アイコン）はここに持たない。アイコンを添えた
 * タブは `src/lib/workflowTabs.ts` が組み立てる。
 *
 * `id` は URL のフォルダ名そのもの（`src/app/(app)/<section>/[id]/<id>/`）。履歴の
 * ラベルは URL の第3セグメントをこの `id` で引くので、フォルダ名と一致していないと
 * 引けない。概要だけは実体そのもののURLなので `path` が空文字になる。
 */

/** 段1つ */
export interface WorkflowStep {
  id: string
  /** タブに出す短い名前（「1. 模範解答」） */
  label: string
  /** 見出しと「次へ」に出す長い名前（「模範解答画像の管理」） */
  title: string
  /** 概要の段カードに添える一文（「試験問題の模範解答画像を取り込む」） */
  description: string
  /** 実体のURL（`/exams/<id>`）からの続き。概要は空文字 */
  path: string
}

/** 段の一覧にある id */
export type WorkflowStepId<Steps extends readonly WorkflowStep[]> =
  Steps[number]["id"]

/**
 * 試験の段。
 *
 * 8. 採点確定は**協調採点でだけ意味を持つ**段で、単独採点では裁定対象が構造的に
 * ゼロになる。それでもタブからは常に見せる ——「あるはずの段が状況によって消える」
 * 方が、開いて「対象なし」と分かるより読みにくい。
 */
export const examWorkflowSteps = [
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    path: "",
  },
  {
    id: "01-upload",
    label: "1. 模範解答",
    title: "模範解答画像の管理",
    description: "試験問題の模範解答画像を取り込む",
    path: "/01-upload",
  },
  {
    id: "02-template",
    label: "2. 採点領域",
    title: "答案の採点領域作成",
    description: "各設問の採点範囲を枠で囲んで決める",
    path: "/02-template",
  },
  {
    id: "03-region-info",
    label: "3. 領域情報",
    title: "採点領域の詳細情報設定",
    description: "各領域の種類・配点・ラベルを決める",
    path: "/03-region-info",
  },
  {
    id: "04-question-group",
    label: "4. 小計点",
    title: "小計点の設定",
    description: "設問をまとめて小計点を出す",
    path: "/04-question-group",
  },
  {
    id: "05-students",
    label: "5. 受験生徒",
    title: "受験生徒の管理",
    description: "この試験を受ける生徒を決める",
    path: "/05-students",
  },
  {
    id: "06-student-answers",
    label: "6. 生徒答案",
    title: "生徒答案の追加と関連付け",
    description: "スキャンした答案画像を取り込み、生徒に結び付ける",
    path: "/06-student-answers",
  },
  {
    id: "07-score-at-once",
    label: "7. 採点",
    title: "一括採点",
    description: "キーボード中心の画面で答案を採点する",
    path: "/07-score-at-once",
  },
  {
    id: "08-finalize",
    label: "8. 採点確定",
    title: "採点の確定",
    description: "採点者どうしで食い違った採点を見比べ、1つに決める",
    path: "/08-finalize",
  },
  {
    id: "09-export",
    label: "9. 結果",
    title: "採点結果のファイル出力",
    description: "採点結果を Excel・PDF で書き出す",
    path: "/09-export",
  },
] as const satisfies readonly WorkflowStep[]

/** 成績算出の段 */
export const gradeWorkflowSteps = [
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    path: "",
  },
  {
    id: "01-students",
    label: "1. 生徒管理",
    title: "生徒の登録",
    description: "成績を出す生徒を決める",
    path: "/01-students",
  },
  {
    id: "02-data-sources",
    label: "2. データソース",
    title: "データソースの設定",
    description: "評価項目ごとに、点数の元になる試験や資料を選ぶ",
    path: "/02-data-sources",
  },
  {
    id: "03-boundaries",
    label: "3. 成績境界",
    title: "成績境界の設定",
    description: "評定を分ける境目を決める",
    path: "/03-boundaries",
  },
  {
    id: "04-comparisons",
    label: "4. 比較",
    title: "比較の設定",
    description: "結果に並べて見る、別の成績算出や別の評価項目を選ぶ",
    path: "/04-comparisons",
  },
  {
    id: "05-results",
    label: "5. 結果",
    title: "成績の確認",
    description: "算出された成績を一覧で確かめる",
    path: "/05-results",
  },
  {
    id: "06-export",
    label: "6. 出力",
    title: "結果の出力",
    description: "成績を Excel・PDF で書き出す",
    path: "/06-export",
  },
] as const satisfies readonly WorkflowStep[]

/** 試験外成績資料の段 */
export const courseworkWorkflowSteps = [
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    path: "",
  },
  {
    id: "02-students",
    label: "1. 生徒管理",
    title: "生徒の登録",
    description: "この資料の対象になる生徒を決める",
    path: "/02-students",
  },
  {
    id: "03-items",
    label: "2. 評価項目",
    title: "評価項目の設定",
    description: "点数を付ける項目と満点を決める",
    path: "/03-items",
  },
  {
    id: "04-scores",
    label: "3. 点数入力",
    title: "点数の入力",
    description: "生徒ごとに点数を入れる",
    path: "/04-scores",
  },
  {
    id: "05-results",
    label: "4. 結果",
    title: "結果の確認",
    description: "入力した点数を一覧で確かめる",
    path: "/05-results",
  },
] as const satisfies readonly WorkflowStep[]

/** 解答用紙作成の段 */
export const answerSheetBuilderWorkflowSteps = [
  {
    id: "detail",
    label: "概要",
    title: "概要",
    description: "名前・日付・タグと、段の進み具合",
    path: "",
  },
  {
    id: "01-edit",
    label: "1. 作成",
    title: "解答用紙の作成",
    description: "解答欄を並べて用紙を組み立てる",
    path: "/01-edit",
  },
  {
    id: "02-export",
    label: "2. 書き出し",
    title: "解答用紙の書き出し",
    description: "組んだ用紙を PDF で書き出す",
    path: "/02-export",
  },
] as const satisfies readonly WorkflowStep[]

/** 段1つ。id は一覧にあるものに限る（型で外れを止める） */
export function workflowStep<Steps extends readonly WorkflowStep[]>(
  steps: Steps,
  stepId: WorkflowStepId<Steps>
): WorkflowStep {
  const step = steps.find((candidateStep) => candidateStep.id === stepId)
  if (!step) throw new Error(`段が見つかりません: ${stepId}`)
  return step
}

/** 段のURL（`entityHref` は実体のURL。`/grades/<id>` など） */
export function workflowStepHref<Steps extends readonly WorkflowStep[]>(
  entityHref: string,
  steps: Steps,
  stepId: WorkflowStepId<Steps>
): string {
  return `${entityHref}${workflowStep(steps, stepId).path}`
}

/**
 * 段の下端に置く「次へ」の文言。右上の「次へ」（`WorkflowTabHeader`）と同じく
 * 行き先の段の `title` から作る。段ごとに文言を書き写すと、上と下で同じ行き先が
 * 違う名前で呼ばれる（成績境界の下が「次へ: 結果」、上が「次へ：成績の確認」だった）。
 */
export function nextStepLabel<Steps extends readonly WorkflowStep[]>(
  steps: Steps,
  nextStepId: WorkflowStepId<Steps>
): string {
  return `次へ：${workflowStep(steps, nextStepId).title}`
}

/** 一覧の「次のステップ」1つ（段の名前と行き先） */
export interface WorkflowNextStep {
  text: string
  url: string
}

/** 一覧の「次のステップ」。名前は段の `title`、行き先は段のURL */
export function nextWorkflowStep<Steps extends readonly WorkflowStep[]>(
  entityHref: string,
  steps: Steps,
  stepId: WorkflowStepId<Steps>
): WorkflowNextStep {
  const step = workflowStep(steps, stepId)
  return { text: step.title, url: `${entityHref}${step.path}` }
}
