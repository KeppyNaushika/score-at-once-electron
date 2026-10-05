/**
 * 07 の「AI採点」モード（docs/vlm-grading-design.md §10）の中で共有する型。
 *
 * main から届く行の形は、IPC の戻り値（main の関数の戻り値に、境界の
 * `serializePrisma` を掛けたもの）から推論で取る。手で書き写さない。
 */

import type {
  LayoutDirection,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"
import type {
  GradingEffort,
  GradingProviderId,
} from "@/electron-src/lib/aiGrading/providers/types"
import type { measureCropRegionInk } from "@/electron-src/lib/aiGrading/sendingImageInspection"
import type {
  listAiGradingRunsByCropRegion,
  listAiGradingRunsByExam,
} from "@/electron-src/lib/prisma/aiGradingRun"
import type {
  getAsbModelAnswerSource,
  listAiPromptsByCropRegion,
} from "@/electron-src/lib/prisma/aiPrompt"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { AiGradingRunMode } from "@/types/aiGrading.types"
import type {
  Serialized,
  StudentAnswerImageWithExamPageAndStudent,
} from "@/types/prismaExtensions"

import type { ReviewedAiGradingAnswer } from "./utils/answerReview"

/** 設問のプロンプト1行（作成者付き） */
export type AiPromptRow = Serialized<
  Awaited<ReturnType<typeof listAiPromptsByCropRegion>>
>[number]

/** 設問の実行1件（試行・プロンプト・改訂の結果・実行者付き） */
export type AiGradingRunRow = Serialized<
  Awaited<ReturnType<typeof listAiGradingRunsByCropRegion>>
>[number]

/** 試験の全設問の実行1件（試行・プロンプト付き。設問一覧の印と、試験の費用に使う） */
export type AiGradingRunOfExamRow = Serialized<
  Awaited<ReturnType<typeof listAiGradingRunsByExam>>
>[number]

/** 試行（答案1件への1回の判定） */
export type AiGradingAttemptRow = AiGradingRunRow["attempts"][number]

/** 答案画像1枚の、この設問の枠1つぶんのインクの測定 */
export type RegionInkMeasurementRow = Serialized<
  Awaited<ReturnType<typeof measureCropRegionInk>>
>[number]["regions"][number]

/** 模範解答の下書きの元（解答用紙の小問・枝問とテキスト要素の木） */
export type AsbModelAnswerSource = NonNullable<
  Serialized<Awaited<ReturnType<typeof getAsbModelAnswerSource>>>
>

/** 試行と、それを出した実行（どちらも行のまま） */
export interface AttemptWithRun {
  attempt: AiGradingAttemptRow
  run: AiGradingRunRow
}

/**
 * 設問の答案1件。答案・自分の採点・自分の試行・インクの測定を、行のまま束ねたもの
 * （行を射影しない。表示の値は描くときに求める）
 */
export interface AiGradingAnswer {
  studentAnswerImage: StudentAnswerImageWithExamPageAndStudent
  /** 自分の採点。無ければ undefined */
  questionScore: QuestionScoreRow | undefined
  /** この答案への試行（採点の実行のものだけ。新しい順） */
  attempts: AttemptWithRun[]
  /** その場で測ったインク。測れなかった答案は null（白紙とはみなさない） */
  inkMeasurement: RegionInkMeasurementRow | null
}

/** 実行の設定（実行ダイアログで選ぶもの。DB には run の列として残る） */
export interface AiRunSettings {
  provider: GradingProviderId
  model: string
  effort: GradingEffort
  mode: AiGradingRunMode
}

/**
 * 一覧の1マス。一覧表示と同じ答案（`ScoringData`。色は自分の採点）に、AI の判定と
 * 印を同梱する。**id は受験者の id**（試行・選択・採用がすべて受験者で引ける）
 */
export interface AiGridItem extends ScoringData {
  reviewedAnswer: ReviewedAiGradingAnswer
}

/**
 * 一覧の表示の設定（一覧表示と同じ設定を読み書きする。採点画面から受け取る）
 */
export interface AiGridDisplaySettings {
  layoutDirection: LayoutDirection
  onLayoutDirectionChange: (direction: LayoutDirection) => void
  itemsPerLine: number[]
  onItemsPerLineChange: (itemsPerLine: number[]) => void
  expandMargin: number
  onExpandMarginChange: (expandMargin: number) => void
  autoScroll: boolean
  showStudentNames: boolean
  /** 一覧の注釈を取り直す合図（詳細で注釈を直したら増える） */
  annotationRefreshKey: number
  /** 詳細で保存した注釈を変えた */
  onAnnotationChanged: () => void
}
