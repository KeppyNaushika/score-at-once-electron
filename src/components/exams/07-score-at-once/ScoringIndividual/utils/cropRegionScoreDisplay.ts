/**
 * 個別表示の答案に、設問1つについて点数と類型の記号のどちらを重ねるかを決める
 *
 * 類型評価の設問の評価済みは、○×△ の代わりに類型の記号を、点数として類型の点数を出す
 * （docs/vlm-grading-design.md §4-8-5）。方式と合わない採点は点数も記号も出さない（§4-8-8）。
 *
 * 点数は出力と同じ単一実装（`calculateActualScore`）で求める
 */
import type { ScaleLevelChoice } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import { calculateActualScore } from "@/lib/shared/actualScore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 設問1つの、答案に重ねる点数と類型の記号 */
interface CropRegionScoreDisplay {
  actualScore: number | null
  /** 採点マークの代わりに出す類型の記号。方式と合う評価済みで類型が見つかったときだけ */
  scaleLevelLabel: string | null
}

/** 何も重ねない */
const NO_DISPLAY: CropRegionScoreDisplay = {
  actualScore: null,
  scaleLevelLabel: null,
}

/**
 * 自分の採点行から、答案に重ねる点数と類型の記号を求める
 *
 * @param scaleLevels 設問の組の類型（`findScaleLevels`）。類型評価でない設問は空
 */
export function cropRegionScoreDisplayOf({
  cropRegion,
  status,
  questionScore,
  scaleLevels,
}: {
  cropRegion: Pick<QuestionAnswerRegionRow, "points" | "scoringMethod">
  status: ScoringStatus
  questionScore: Pick<QuestionScoreRow, "partialScore" | "scaleLevelId"> | null
  scaleLevels: readonly ScaleLevelChoice[]
}): CropRegionScoreDisplay {
  // 類型評価の評価済みは、組の類型から付けた類型を引く（類型が消えた・見つからなければ null）
  const scaleLevel =
    status === "evaluated"
      ? (scaleLevels.find(
          (scaleLevelChoice) =>
            scaleLevelChoice.id === questionScore?.scaleLevelId
        ) ?? null)
      : null
  const actualScore = calculateActualScore(
    {
      status,
      partialScore:
        questionScore?.partialScore != null
          ? Number(questionScore.partialScore)
          : null,
      scaleLevel,
    },
    cropRegion
  )
  if (actualScore === null) return NO_DISPLAY
  return { actualScore, scaleLevelLabel: scaleLevel?.label ?? null }
}
