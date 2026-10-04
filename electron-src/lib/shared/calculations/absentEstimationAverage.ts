/**
 * 欠測推定の平均比率法と、各推定法が共有する土台。
 *
 * - 推定結果の型（AbsentEstimation）と、推定が受ける行・素点行列の形
 * - 説明変数（対象生徒が実測を持つ他ソース）の収集
 * - 平均比率法そのものと、他の推定法が平均比率法へ落ちるときの共通処理
 *
 * 手法の振り分けは `absentEstimation.ts`、重回帰法は `absentEstimationRegression.ts`、
 * 標準偏差法・順位法は `absentEstimationEquating.ts` にある。
 */

import type {
  AbsentMethod,
  EstimationDroppedPredictor,
  EstimationFallbackReason,
  EstimationRegressionTerm,
  EstimationSourceContribution,
} from "../../../../src/types/grade.types"
import type { DataSourceInfo } from "./gradeCalculatorTypes"
import type {
  RawScoreMatrix,
  RawScoreRow,
  RawScoreRowEntity,
} from "./rawScoreMatrix"

/** 推定は行を識別できれば足りるので、行の実体は最小限の形で受ける */
export type EstimationRow = RawScoreRow<RawScoreRowEntity>
export type EstimationMatrix = RawScoreMatrix<RawScoreRowEntity>

/**
 * 欠測推定の生の結果（乗率・加減点の適用前）。
 * gradeCalculator が乗率・加減点を適用して最終的な EstimationDetail を組み立てる。
 */
export interface AbsentEstimation {
  /** 推定素点（内部クランプ済み、乗率・加減点適用前） */
  value: number
  /** 実際に使われた推定方法（regressionがaverageにフォールバックした場合は"average"） */
  effectiveMethod: AbsentMethod
  /** 平均比率法（フォールバック含む）で使用したソース内訳 */
  averageSources?: EstimationSourceContribution[]
  /** 平均比率法の平均比率 */
  averageRatio?: number
  /** 重回帰法の切片（β0） */
  intercept?: number
  /** 重回帰法の各説明変数の項（採用＝従属でない列のみ） */
  regressionTerms?: EstimationRegressionTerm[]
  /** 多重共線性でランク落ち除外した説明変数（従属列） */
  droppedPredictors?: EstimationDroppedPredictor[]
  /** 重回帰法がaverageにフォールバックした理由 */
  fallbackReason?: EstimationFallbackReason
  /**
   * 当てはまりの重相関 R（訓練データの実測 vs 予測、0〜1）。
   * 予測は「実力の R 倍」まで広がる縮小率そのもの。1−R が中心（平均）へ寄る度合い。
   * R=1 は定義上のつながり（合計=小計の和 等）で完全復元されている合図。
   *
   * **なぜ R で割ると散らばりが戻るのか。** OLS の予測には恒等式
   * `SD(ŷ) = R × SD(y)` が成り立つ（訓練データ上で。R は実測と予測の相関）。
   * つまり予測はいつも実測より R 倍だけ縮んでいる。したがって `1/R` を掛ければ、
   * 散らばりが実測と同じ幅まで戻る。中心（平均）は動かないので、上位は上へ、
   * 下位は下へ広がる —— 平均回帰の打ち消しは、これ1つで説明が付く。
   *
   * **素の R を使うこと。自由度補正した R では割りすぎる。** 補正済みの R は
   * 素の R より小さいので `1/R` が大きくなり、実測より広い散らばりを作ってしまう。
   * `multipleCorrelationR` が返すのは補正済みの値なので、増幅に使うなら素の R を
   * 別に取ること。
   *
   * **R が極端に小さい領域では増幅が暴れる。** 予測がほぼ無相関なのに大きく
   * 引き伸ばすことになるため。落とし先は等重み標準偏差法にする（平均比率法へは
   * 落とさない —— あちらは誤差も縮小も大きい）。
   */
  correlation?: number
  /** 標準偏差法（zscore）: 対象生徒の他ソース平均標準得点（±何SD） */
  standardizedStanding?: number
  /** 順位法（equipercentile）: 対象生徒の他ソース平均パーセンタイル（0〜1） */
  percentileRank?: number
  /** 標準偏差法・順位法の載せ替え先となる当ソース実測分布の平均 */
  targetMean?: number
  /** 標準偏差法の載せ替え先となる当ソース実測分布の標準偏差 */
  targetStandardDeviation?: number
}

/**
 * 説明変数1つ分。表示用の内訳（contribution）と、分布の引き直しに使う列の実体を持つ。
 * 内訳だけだと再び id 文字列からソースを引き当てる必要が生じるため実体を添える。
 */
interface PredictorContribution {
  dataSource: DataSourceInfo
  contribution: EstimationSourceContribution
}

/**
 * 対象生徒が実測を持つ他ソースを、標準偏差法・順位法の説明変数として集める。
 * average と同じく「自ソース以外・満点>0・対象生徒が実測を持つ」ソースが対象。
 */
export function collectPredictorContributions(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): PredictorContribution[] {
  const predictors: PredictorContribution[] = []
  for (const predictorSource of allDataSources) {
    if (predictorSource.id === dataSource.id) continue
    if (predictorSource.maxScore <= 0) continue
    const score = matrix.scoreOf(targetRow, predictorSource)
    if (score === null) continue
    predictors.push({
      dataSource: predictorSource,
      contribution: {
        id: predictorSource.id,
        name: predictorSource.name,
        score,
        maxScore: predictorSource.maxScore,
        ratio: score / predictorSource.maxScore,
      },
    })
  }
  return predictors
}

/**
 * 平均比率推定: 同じ生徒の他DataSourceのスコア比率(score/maxScore)を平均
 * → 平均比率 × 当該DataSource.maxScore
 */
export function estimateByAverage(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  const averageSources = collectPredictorContributions(
    targetRow,
    dataSource,
    matrix,
    allDataSources
  ).map((predictor) => predictor.contribution)

  if (averageSources.length === 0) return null
  const averageRatio =
    averageSources.reduce(
      (sum, averageSource) => sum + averageSource.ratio,
      0
    ) / averageSources.length
  return {
    value: clamp(averageRatio * dataSource.maxScore, 0, dataSource.maxScore),
    effectiveMethod: "average",
    averageSources,
    averageRatio,
  }
}

/**
 * 重回帰法がサンプル不足/特異行列で平均比率法に落ちた場合の共通処理。
 * averageの推定結果にフォールバック理由を付与して返す。
 */
export function fallbackToAverage(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[],
  reason: EstimationFallbackReason
): AbsentEstimation | null {
  const fallback = estimateByAverage(
    targetRow,
    dataSource,
    matrix,
    allDataSources
  )
  if (fallback === null) return null
  return { ...fallback, fallbackReason: reason }
}

/**
 * 値を[min, max]範囲にクランプ
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
