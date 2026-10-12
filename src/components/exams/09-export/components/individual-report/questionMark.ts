import type { ScoreDetail } from "@/electron-src/lib/shared/types"
import { formatScaleValue } from "@/lib/shared/scaleValueDisplay"
import type { ScaleValueDisplay } from "@/types/rubric.types"

/** 評価マーク・得点の文字を決めるのに要る設問の採点 */
type QuestionScoreForMark = Pick<
  ScoreDetail,
  "status" | "scoringMethod" | "scaleLevel"
>

/**
 * 評価マーク情報を取得
 * プレビュー（React）とPDF出力（renderToStaticMarkup）の両方で使用
 *
 * 類型評価の設問は正誤が無いので、○×△の代わりに付けた類型の記号を出す
 * （docs/vlm-grading-design.md §4-8-5）。類型が無い（未評価・方式と合わない採点）ときは
 * 無答の「-」のほかは空欄にする。
 */
export function getMarkInfo(questionScore: QuestionScoreForMark): {
  mark: string
  markColor: string
} {
  if (questionScore.scoringMethod === "scale") {
    if (questionScore.scaleLevel !== null) {
      return { mark: questionScore.scaleLevel.label, markColor: "#333" }
    }
    if (questionScore.status === "no_answer") {
      return { mark: "-", markColor: "#666" }
    }
    return { mark: "", markColor: "#333" }
  }

  switch (questionScore.status) {
    case "correct":
      return { mark: "○", markColor: "#16a34a" }
    case "incorrect":
      return { mark: "×", markColor: "#dc2626" }
    case "partial":
      return { mark: "△", markColor: "#ca8a04" }
    case "no_answer":
      return { mark: "-", markColor: "#666" }
    default:
      return { mark: "", markColor: "#333" }
  }
}

/**
 * 設問の得点欄の文字（「/ 配点」の前の部分）。
 *
 * 類型評価の設問は、付けた類型を見せ方（`scaleValueDisplay`）に従って「8」「A (8)」「A」のどれかで出す
 * （docs/vlm-grading-design.md §4-8-8）。類型が無ければ「-」。それ以外の設問は得点（無ければ「-」）。
 */
export function formatQuestionScoreText(
  questionScore: QuestionScoreForMark & Pick<ScoreDetail, "score">,
  scaleValueDisplay: ScaleValueDisplay
): string {
  if (questionScore.scoringMethod === "scale") {
    if (questionScore.scaleLevel === null) return "-"
    return formatScaleValue(
      {
        label: questionScore.scaleLevel.label,
        pointsText: String(questionScore.scaleLevel.score),
      },
      scaleValueDisplay
    )
  }
  return questionScore.score === null ? "-" : String(questionScore.score)
}

/**
 * 設問の正答率の欄の文字。類型評価の設問は正答率を出さない（「—」。§4-8-5）。
 * 正答率が無い設問（main が数えなかったもの）も「—」にする。
 */
export function formatQuestionCorrectRateText(
  questionScore: Pick<ScoreDetail, "questionId" | "scoringMethod">,
  questionCorrectRates: Record<string, number>
): string {
  const correctRate = questionCorrectRates[questionScore.questionId]
  if (questionScore.scoringMethod === "scale" || correctRate === undefined) {
    return "—"
  }
  return `${Math.round(correctRate)}%`
}
